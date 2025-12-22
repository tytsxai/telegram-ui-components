import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import TemplateFlowDiagram, { MAX_VISIBLE_NODES } from "../TemplateFlowDiagram";
import { __getLatestProps } from "reactflow";
import { act } from "@testing-library/react";

type MockNode = { id: string; data?: { label?: React.ReactNode }; position?: { x: number; y: number } };
type MockChange = { id: string; position?: { x: number; y: number } };
type MockReactFlowProps = {
  nodes?: MockNode[];
  children?: React.ReactNode;
  onInit?: (instance: { fitView: ReturnType<typeof vi.fn>; setCenter: ReturnType<typeof vi.fn> }) => void;
  onNodesChange?: (changes: MockChange[]) => void;
};

vi.mock("reactflow", () => {
  const MarkerType = { ArrowClosed: "arrowclosed" };
  const Position = { Right: "right", Left: "left" };
  const instance = { fitView: vi.fn(), setCenter: vi.fn() };
  let latestProps: MockReactFlowProps | null = null;

  const ReactFlow = (props: MockReactFlowProps) => {
    latestProps = props;
    React.useEffect(() => {
      props.onInit?.(instance);
    }, [props]);
    return (
      <div data-testid="reactflow">
        {props.nodes?.map((node) => (
          <div key={node.id} data-node-id={node.id}>
            {typeof node.data?.label === "string" ? node.data.label : node.data?.label}
          </div>
        ))}
        {props.children}
      </div>
    );
  };

  const useNodesState = (initial: MockNode[]) => {
    const [state, setState] = React.useState(initial);
    const onChange = React.useCallback((changes: MockChange[]) => {
      setState((prev: MockNode[]) =>
        prev.map((node) => {
          const change = changes.find((c) => c.id === node.id && c.position);
          if (change && change.position) {
            return { ...node, position: change.position };
          }
          return node;
        }),
      );
    }, []);
    return [state, setState, onChange] as const;
  };

  const useEdgesState = (initial: unknown[]) => {
    const [state, setState] = React.useState(initial);
    const onChange = React.useCallback(() => {}, []);
    return [state, setState, onChange] as const;
  };

  const Background = ({ children }: React.PropsWithChildren) => <div data-testid="background">{children}</div>;
  const Controls = ({ children }: React.PropsWithChildren) => <div data-testid="controls">{children}</div>;
  const MiniMap = ({ children }: React.PropsWithChildren) => <div data-testid="minimap">{children}</div>;

  return {
    __esModule: true,
    default: ReactFlow,
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    Position,
    __getLatestProps: () => latestProps,
  };
});

beforeAll(() => {
  // @ts-expect-error jsdom missing ResizeObserver
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const makeScreen = (id: string, links: string[] = []) => ({
  id,
  name: id.toUpperCase(),
  message_content: `${id} content`,
  keyboard: [
    {
      id: `${id}-row`,
      buttons: links.map((target, idx) => ({
        id: `${id}-btn-${idx}`,
        text: `to ${target}`,
        linked_screen_id: target,
      })),
    },
  ],
  is_public: false,
});

describe("TemplateFlowDiagram", () => {
  beforeEach(() => {
    // Provide ResizeObserver for Radix UI internals
    // @ts-expect-error jsdom polyfill
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    localStorage.clear();
  });

  afterEach(() => {
    // @ts-expect-error cleanup
    delete global.ResizeObserver;
  });

  it("renders a cycle badge when screens form a loop", async () => {
    const screens = [makeScreen("a", ["b"]), makeScreen("b", ["a"])];
    render(
      <TemplateFlowDiagram
        screens={screens}
        currentScreenId="a"
        open
        onOpenChange={() => {}}
      />,
    );

    const badges = await screen.findAllByText("循环");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("hides isolated nodes when the toggle is enabled", async () => {
    const screens = [makeScreen("a", ["b"]), makeScreen("b"), makeScreen("c")];
    render(
      <TemplateFlowDiagram
        screens={screens}
        currentScreenId="a"
        open
        onOpenChange={() => {}}
      />,
    );

    const getLatestProps = __getLatestProps as unknown as () => MockReactFlowProps | null;
    expect(getLatestProps()?.nodes?.find((n) => n.id === "c")).toBeDefined();

    fireEvent.click(screen.getByLabelText("隐藏孤立"));

    await waitFor(() => {
      expect(getLatestProps()?.nodes?.find((n) => n.id === "c")).toBeUndefined();
    });
  });

  it("restores layout positions from localStorage when opened", async () => {
    const screens = [makeScreen("home")];
    localStorage.setItem("diagram_positions_anon", JSON.stringify([{ id: "home", x: 120, y: 80 }]));

    render(
      <TemplateFlowDiagram
        screens={screens}
        currentScreenId="home"
        open
        onOpenChange={() => {}}
      />,
    );

    await waitFor(() => {
      const getLatestProps = __getLatestProps as unknown as () => MockReactFlowProps | null;
      const props = getLatestProps();
      expect(props?.nodes?.find((n) => n.id === "home")?.position).toMatchObject({ x: 120, y: 80 });
    });
  });

  it("limits visible nodes and shows a performance warning on large graphs", async () => {
    vi.useFakeTimers();
    const screens = Array.from({ length: MAX_VISIBLE_NODES + 40 }, (_, idx) => makeScreen(`n-${idx}`));

    render(
      <TemplateFlowDiagram
        screens={screens}
        currentScreenId="n-0"
        open
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText(/节点过多/)).toBeTruthy();

    await act(async () => {
      vi.runAllTimers();
    });

    const getLatestProps = __getLatestProps as unknown as () => MockReactFlowProps | null;
    const props = getLatestProps();
    expect((props?.nodes ?? []).length).toBeLessThanOrEqual(MAX_VISIBLE_NODES);
    vi.useRealTimers();
  });

  it("does not show performance warning when node count is at the limit", () => {
    const screens = Array.from({ length: MAX_VISIBLE_NODES }, (_, idx) => makeScreen(`n-${idx}`));

    render(
      <TemplateFlowDiagram
        screens={screens}
        currentScreenId="n-0"
        open
        onOpenChange={() => {}}
      />,
    );

    expect(screen.queryByText(/节点过多/)).toBeNull();
  });

  it("culls nodes outside the viewport", async () => {
    const rect = {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      toJSON: () => {},
    } as DOMRect;
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect);
    const screens = [makeScreen("in"), makeScreen("out")];
    localStorage.setItem(
      "diagram_positions_anon",
      JSON.stringify([
        { id: "in", x: 80, y: 60 },
        { id: "out", x: 4000, y: 4000 },
      ]),
    );

    render(
      <TemplateFlowDiagram
        screens={screens}
        currentScreenId="in"
        open
        onOpenChange={() => {}}
      />,
    );

    await waitFor(() => {
      const getLatestProps = __getLatestProps as unknown as () => MockReactFlowProps | null;
      const props = getLatestProps();
      expect(props?.nodes?.find((n) => n.id === "out")).toBeUndefined();
      expect(props?.nodes?.find((n) => n.id === "in")).toBeDefined();
    });
    rectSpy.mockRestore();
  });

  it("keeps nodes that sit on the viewport edge", async () => {
    const rect = {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      toJSON: () => {},
    } as DOMRect;
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect);
    const screens = [makeScreen("edge"), makeScreen("inside")];
    localStorage.setItem(
      "diagram_positions_anon",
      JSON.stringify([
        { id: "edge", x: -380, y: 0 },
        { id: "inside", x: 40, y: 40 },
      ]),
    );

    render(
      <TemplateFlowDiagram
        screens={screens}
        currentScreenId="inside"
        open
        onOpenChange={() => {}}
      />,
    );

    await waitFor(() => {
      const getLatestProps = __getLatestProps as unknown as () => MockReactFlowProps | null;
      const props = getLatestProps();
      expect(props?.nodes?.find((n) => n.id === "edge")).toBeDefined();
    });
    rectSpy.mockRestore();
  });
});
