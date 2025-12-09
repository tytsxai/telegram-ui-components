import { KeyboardRow } from "@/types/telegram";

const newId = () => `row-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;

export const createDefaultKeyboard = (): KeyboardRow[] => [
  {
    id: newId(),
    buttons: [
      { id: `${Date.now()}-btn-1`, text: "Button 1", callback_data: "btn_1_action" },
      { id: `${Date.now()}-btn-2`, text: "Button 2", callback_data: "btn_2_action" },
    ],
  },
];

export const cloneKeyboard = (keyboard: KeyboardRow[]): KeyboardRow[] =>
  JSON.parse(JSON.stringify(keyboard)) as KeyboardRow[];

export const safeKeyboard = (keyboard?: KeyboardRow[]): KeyboardRow[] =>
  cloneKeyboard(keyboard ?? createDefaultKeyboard());

export const keyboardIdHelpers = { newId };
