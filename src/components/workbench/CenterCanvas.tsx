import React from "react";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Undo2, Redo2, Edit2, Sparkles, Network } from "lucide-react";
import MessageBubble, { MessageBubbleHandle } from "../MessageBubble";
import InlineKeyboard from "../InlineKeyboard";
import { Screen, KeyboardRow, KeyboardButton } from "@/types/telegram";
import { SyncStatus } from "@/types/sync";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CenterCanvasProps {
    messageContent: string;
    setMessageContent: (content: string | ((prev: string) => string)) => void;
    keyboard: KeyboardRow[];
    parseMode: "HTML" | "MarkdownV2";
    onParseModeChange: (mode: "HTML" | "MarkdownV2") => void;
    messageType: "text" | "photo" | "video";
    mediaUrl: string;
    onMessageTypeChange: (type: "text" | "photo" | "video") => void;
    onMediaUrlChange: (url: string) => void;

    // Handlers
    onButtonTextChange: (rowId: string, buttonId: string, newText: string) => void;
    onButtonUpdate: (rowId: string, buttonId: string, updatedButton: KeyboardButton) => void;
    onDeleteButton: (rowId: string, buttonId: string) => void;
    onButtonClick: (button: KeyboardButton) => void;
    onKeyboardReorder: (rows: KeyboardRow[]) => void;

    // State
    isPreviewMode: boolean;
    onToggleMode: () => void;
    onOpenTemplateLibrary: () => void;
    onOpenFlowDiagram?: () => void;

    // Undo/Redo
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;

    // Refs
    messageBubbleRef: React.RefObject<MessageBubbleHandle>;

    // Context
    screens: Screen[];
    navigationHistory: string[];
    currentScreenId?: string;
    onNavigateBack: () => void;
    currentScreenName?: string;
    entryScreenId?: string | null;
    // Status
    hasUnsavedChanges?: boolean;
    isOffline?: boolean;
    shareSyncStatus?: SyncStatus;
    layoutSyncStatus?: SyncStatus;
    pendingQueueSize?: number;
}

export const CenterCanvas = React.memo<CenterCanvasProps>(({
    messageContent,
    setMessageContent,
    keyboard,
    onButtonTextChange,
    onButtonUpdate,
    onDeleteButton,
    onButtonClick,
    onKeyboardReorder,
    isPreviewMode,
    onToggleMode,
    onOpenTemplateLibrary,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    messageBubbleRef,
    screens,
    navigationHistory,
    currentScreenId,
    onNavigateBack,
    currentScreenName,
    entryScreenId,
    hasUnsavedChanges,
    isOffline,
    shareSyncStatus,
    layoutSyncStatus,
    pendingQueueSize,
    parseMode,
    onParseModeChange,
    messageType,
    mediaUrl,
    onMessageTypeChange,
    onMediaUrlChange,
    onOpenFlowDiagram,
}) => {
    const applyTheme = React.useCallback(() => {
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const shouldUseDark = savedTheme ? savedTheme === "dark" : prefersDark;
        document.documentElement.classList.toggle("dark", shouldUseDark);
    }, []);

    const handleMediaChange = React.useCallback((event: MediaQueryListEvent) => {
        if (localStorage.getItem("theme")) return;
        document.documentElement.classList.toggle("dark", event.matches);
    }, []);

    const handleStorageChange = React.useCallback((event: StorageEvent) => {
        if (event.key !== "theme") return;
        applyTheme();
    }, [applyTheme]);

    React.useEffect(() => {
        applyTheme();
        const controller = new AbortController();
        const { signal } = controller;
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        mediaQuery.addEventListener("change", handleMediaChange, { signal });
        window.addEventListener("storage", handleStorageChange, { signal });

        return () => {
            controller.abort();
            mediaQuery.removeEventListener("change", handleMediaChange);
            window.removeEventListener("storage", handleStorageChange);
        };
    }, [applyTheme, handleMediaChange, handleStorageChange]);

    const activeScreenId = currentScreenId ?? navigationHistory[navigationHistory.length - 1];
    const isEntryActive = !!entryScreenId && activeScreenId === entryScreenId;

    const renderStatusBadge = (label: string, status?: SyncStatus) => {
        if (!status || status.state === "idle") return null;
        const color =
            status.state === "success" ? "bg-emerald-500/20 text-emerald-700 border-emerald-500/50" :
                status.state === "error" ? "bg-destructive/10 text-destructive border-destructive/50" :
                    "bg-amber-500/10 text-amber-700 border-amber-500/50";
        const text =
            status.state === "success" ? `${label}已同步` :
                status.state === "error" ? `${label}失败` :
                    `${label}中`;
        return (
            <span
                className={`px-2 py-0.5 text-[10px] rounded-full border inline-flex items-center gap-1 ${color}`}
                title={status.message || status.requestId}
            >
                {text}
            </span>
        );
    };

    return (
        <div className="flex flex-col items-center w-full h-full overflow-hidden">
            {/* Canvas Toolbar - Decoupled from phone width constraint */}
            <div className="w-full shrink-0 p-4 z-10">
                <div className="w-full max-w-3xl mx-auto flex justify-between items-center bg-card/80 backdrop-blur p-2 rounded-lg shadow-sm border border-border/50">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Button
                            variant={isPreviewMode ? "default" : "ghost"}
                            size="sm"
                            onClick={onToggleMode}
                            className="h-8 shrink-0"
                        >
                            {isPreviewMode ? <Eye className="w-3 h-3 mr-2" /> : <Edit className="w-3 h-3 mr-2" />}
                            {isPreviewMode ? "预览" : "编辑"}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onOpenTemplateLibrary}
                            className="h-8 bg-gradient-to-r from-emerald-500/80 via-cyan-500/80 to-blue-500/80 text-white border-none shadow-sm shrink-0"
                        >
                            <Sparkles className="w-3 h-3 mr-2" />
                            模板库
                        </Button>
                        {onOpenFlowDiagram && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onOpenFlowDiagram}
                                className="h-8 shrink-0"
                                title="查看关系图"
                            >
                                <Network className="w-3 h-3 mr-2" />
                                关系图
                            </Button>
                        )}

                        {/* Breadcrumbs / Title */}
                        <div className="flex items-center gap-2 ml-2 overflow-hidden min-w-0">
                            <span className="text-xs text-muted-foreground font-medium truncate whitespace-nowrap">
                                {currentScreenName || "未命名模版"}
                            </span>
                            <div className="flex items-center shrink-0 gap-1">
                                {hasUnsavedChanges && (
                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" title="未保存" />
                                )}
                                {isOffline && (
                                    <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" title="离线" />
                                )}
                                {isEntryActive && currentScreenName && (
                                    <span className="px-2 py-0.5 text-[10px] rounded-full border bg-emerald-500/10 text-emerald-700 border-emerald-500/50 shrink-0">
                                        入口
                                    </span>
                                )}
                                {renderStatusBadge("分享", shareSyncStatus)}
                                {renderStatusBadge("布局", layoutSyncStatus)}
                            </div>
                            {pendingQueueSize && pendingQueueSize > 0 && (
                                <span
                                    className="px-2 py-0.5 text-[10px] rounded-full border bg-amber-500/10 text-amber-700 border-amber-500/50 shrink-0 whitespace-nowrap"
                                    title="离线队列：连接网络后会自动重试，或在底部面板手动重试/清空"
                                >
                                    待同步 {pendingQueueSize}
                                </span>
                            )}
                        </div>
                    </div>

                    {!isPreviewMode && (
                        <div className="flex gap-2 items-center shrink-0 ml-2">
                            <div className="flex items-center gap-1">
                                <Select value={parseMode} onValueChange={(v) => onParseModeChange(v as "HTML" | "MarkdownV2")}>
                                    <SelectTrigger className="h-8 w-[130px]">
                                        <SelectValue placeholder="Parse mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="HTML">HTML</SelectItem>
                                        <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="h-8 w-8" title="撤销">
                                <Undo2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} className="h-8 w-8" title="重做">
                                <Redo2 className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    const isDark = document.documentElement.classList.toggle("dark");
                                    localStorage.setItem("theme", isDark ? "dark" : "light");
                                }}
                                className="h-8 w-8 ml-2"
                                title="切换日间/夜间模式"
                            >
                                <span className="dark:hidden">🌙</span>
                                <span className="hidden dark:inline">☀️</span>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable Phone Area */}
            <div className="flex-1 w-full overflow-y-auto no-scrollbar px-4 pb-8">
                <div className="w-full max-w-md mx-auto">
                    {/* Navigation Back Button (Preview Mode) */}
                    {isPreviewMode && navigationHistory.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={onNavigateBack}
                            className="w-full mb-4"
                            size="sm"
                        >
                            <Edit2 className="w-4 h-4 mr-2 rotate-180" />
                            返回 ({navigationHistory.length})
                        </Button>
                    )}

                    {/* Phone Simulator */}
                    <div className="w-full bg-telegram-bg shadow-xl rounded-3xl overflow-hidden border-8 border-slate-800 ring-1 ring-slate-900/10 relative transition-colors duration-300">
                        {/* Status Bar Mockup */}
                        <div className="bg-telegram-header h-8 w-full" />

                        {/* Header */}
                        <div className="bg-telegram-header px-4 py-3 flex items-center space-x-3 shadow-md relative z-10">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                                TB
                            </div>
                            <div className="flex-1">
                                <h2 className="text-white font-semibold text-sm">Telegram Bot</h2>
                                <p className="text-white/70 text-xs">bot</p>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="min-h-[500px] p-4 font-telegram relative">
                            {/* Background Pattern could go here */}
                            <div className="inline-block max-w-[90%] w-full space-y-3">
                                {messageType !== "text" && mediaUrl && (
                                    <div className="w-full rounded-xl overflow-hidden border border-border bg-black/40">
                                        {messageType === "photo" ? (
                                            <img src={mediaUrl} alt="media preview" className="w-full object-cover" />
                                        ) : (
                                            <video src={mediaUrl} controls className="w-full object-cover" />
                                        )}
                                    </div>
                                )}
                                <MessageBubble
                                    ref={messageBubbleRef}
                                    content={messageContent}
                                    onContentChange={setMessageContent}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {messageType !== "text" && (
                                        <div className="text-xs text-muted-foreground">
                                            当前消息类型: {messageType} {mediaUrl ? "(已设置URL)" : "(未设置URL)"}
                                        </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                        Parse Mode: {parseMode}
                                    </div>
                                </div>
                                <InlineKeyboard
                                    keyboard={keyboard}
                                    onButtonTextChange={onButtonTextChange}
                                    onButtonUpdate={onButtonUpdate}
                                    onDeleteButton={onDeleteButton}
                                    onButtonClick={onButtonClick}
                                    isPreviewMode={isPreviewMode}
                                    screens={screens}
                                    onReorder={onKeyboardReorder}
                                />
                            </div>
                        </div>

                        {/* Home Indicator Mockup */}
                        <div className="h-6 bg-telegram-bg w-full flex justify-center items-center">
                            <div className="w-32 h-1 bg-black/20 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default CenterCanvas;
