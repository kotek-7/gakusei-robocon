import { useRef, type ReactNode } from "react";
import { Menu } from "../ui/Menu";
import { download } from "../ui/files";
import { readStudy, createStudy, type Study } from "../study/state";
export function NotebookMenu({
  study,
  update,
  busy,
  undo,
  redo,
  canUndo,
  canRedo,
  onError,
  children,
}: {
  study: Study;
  update: (s: Study) => void;
  busy: boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onError: (v: string) => void;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="toolbar app-menus">
      <Menu label="ファイル">
        <button
          onClick={() =>
            download(
              "作戦ノート.json",
              JSON.stringify(study, null, 2),
              "application/json",
            )
          }
        >
          ファイルに保存
        </button>
        <button disabled={busy} onClick={() => input.current?.click()}>
          読み込む
        </button>
        <button
          disabled={busy}
          onClick={() => {
            download(
              "作戦ノート控え.json",
              JSON.stringify(study, null, 2),
              "application/json",
            );
            update(createStudy());
          }}
        >
          新しいノート（現在の内容を保存）
        </button>
      </Menu>
      <Menu label="編集">
        <button disabled={busy || !canUndo} onClick={undo}>
          取り消す　Ctrl / ⌘ Z
        </button>
        <button disabled={busy || !canRedo} onClick={redo}>
          やり直す　Ctrl / ⌘ Shift Z
        </button>
      </Menu>
      <Menu label="表示">{children}</Menu>
      <input
        ref={input}
        type="file"
        hidden
        accept="application/json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          try {
            if (file) update(readStudy(JSON.parse(await file.text())));
          } catch (err) {
            onError(String(err));
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
