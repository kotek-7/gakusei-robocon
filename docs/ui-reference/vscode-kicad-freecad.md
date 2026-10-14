# Peripheral UI reference: VS Code / KiCad / FreeCAD (source-derived)

Scope: peripheral chrome (menus, toolbars, bars, palettes, prefs, filters, 3D view controls), extracted from source, not docs.
Target: robocon match-analysis tool (3D field viewport, 180 s replay with 4 robots, timeline, state-transition graph,
candidate strategy tables, condition/spec editor, evaluation tables). Current app panes: `web/src/explorer/{App,Candidates,Classification,Comparison,Conditions,Evaluation,Graph,Inspector,SearchProgress}.tsx`, `web/src/viewport/Viewport.tsx`.

Clones (sparse, depth 1) under `scratchpad/oss/`. Path prefixes used below:
- **VSC** = `oss/vscode/src/vs/workbench/` (plus `oss/vscode/src/vs/platform/actions/common/actions.ts` = **ACT**)
- **KC** = `oss/kicad/` (KiCad mirror master)
- **FC** = `oss/freecad/src/Gui/`

Mapping column: concrete suggestion for our app, or `skip: reason`. Priority tag: **P1** = do first, **P2** = nice, blank = optional.

---

## 1. Menubar

| # | Tool | Source (file:symbol) | Function | Mapping |
|---|---|---|---|---|
| 1 | VSC | ACT:`MenuId.MenubarFileMenu/EditMenu/SelectionMenu/ViewMenu/GoMenu/HelpMenu` | Top-level menu ids; menus are data-driven registries, any contribution can append | **P1** Build menubar from a `MenuId`-style registry: File / Edit / View / Go / Match / Analysis / Help; every command registered once, placed in menus+palette+keybindings by id |
| 2 | VSC | ACT:`MenuId.MenubarRecentMenu` + `browser/actions/windowActions.ts` "Open Recent", "Remove from Recently Opened" | Recent list with per-item remove | **P1** File > Open Recent (match logs / scenario JSON), with "Clear Recent" and per-row x |
| 3 | VSC | ACT:`MenuId.MenubarAppearanceMenu` | View>Appearance submenu (full screen, zen, centered, menu bar, side bar pos, panel pos) | **P1** View > Appearance submenu bundling layout toggles (see §13) |
| 4 | VSC | ACT:`MenuId.MenubarLayoutMenu` / `MenubarSwitchGroupMenu` | Editor layout presets (2 cols, grid 2x2) | **P2** View > Layout: "Viewport + Timeline", "Graph + Tables", "2x2 Compare" presets |
| 5 | VSC | ACT:`MenuId.MenubarGoMenu` / `browser/actions/navigationActions.ts` | Back/Forward, go to file/symbol/line | **P1** Go menu: Back/Forward selection history, Go to Time (t=), Go to State, Go to Candidate |
| 6 | VSC | `browser/parts/titlebar/menubarControl.ts`:`MenubarControl` (compact "Hamburger" mode) | Menubar collapses to a single menu button when space is tight | **P2** Collapse menubar to ☰ under 900 px |
| 7 | VSC | `browser/actions/layoutActions.ts` `workbench.action.toggleMenuBar` | Hide/show menubar | skip: browser app has little vertical pressure from one row; keep always visible |
| 8 | VSC | ACT:`MenuId.MenubarPreferencesMenu` | Preferences: Settings, Keyboard Shortcuts, Theme | **P1** Help/Preferences menu: Settings, Keyboard Shortcuts, Color Theme |
| 9 | KC | `KC/pcbnew/menubar_pcb_editor.cpp`:`PCB_EDIT_FRAME::doReCreateMenuBar` fileMenu `openRecentMenu` + `UpdateClearText("Clear Recent Files")` | Recent files submenu with clear entry | Same as #2 |
| 10 | KC | same: `submenuImport` / `submenuExport` | Import/Export submenus grouped by format | **P1** File > Import (match log, rulebook params) / Export (CSV of candidates, JSON spec, PNG of viewport, SVG of graph) |
| 11 | KC | same: `submenuFabOutputs` | "Fabrication Outputs" = batch generators | **P2** File > Reports: "Generate match report" (HTML/MD bundle of evaluation tables) |
| 12 | KC | same: `ACTIONS::revert`, `PCB_ACTIONS::rescueAutosave` | Revert to saved; rescue autosave | **P1** File > Revert Spec; "Restore autosave" for condition editor drafts |
| 13 | KC | same: `PCB_ACTIONS::compareBoardWithFile`, `compareBoardWithHistory` | Diff current vs file / history | **P1** Analysis > Compare with saved run / previous run (feeds Comparison.tsx) |
| 14 | KC | same: editMenu `selectSubMenu` (Select All / Unselect All) | Select submenu | **P2** Edit > Select > All robots / None / Same team |
| 15 | KC | same: `ACTIONS::find`, `PCB_ACTIONS::findByProperties` | Find + find-by-property | **P1** Edit > Find (Ctrl+F in focused table) and "Find by property" (e.g. score>X) |
| 16 | KC | same: viewMenu `showHidePanels` (CHECK items: Properties, Search, Layers, Net Inspector, Constraints) | Panels submenu with check marks | **P1** View > Panels: ☑ Inspector ☑ Graph ☑ Candidates ☑ Conditions ☑ Evaluation ☑ Timeline |
| 17 | KC | same: viewMenu `drawingModeSubMenu` (zone filled/outline, pad/via/track outline) | Display-mode check submenu | **P1** View > Drawing Mode: robots solid/outline, trails on/off, footprints filled/outline |
| 18 | KC | same: `contrastModeSubMenu` (highContrastMode, layerAlphaDec/Inc) | Dim inactive + alpha +/- | **P1** View > Contrast: dim non-selected robots; opacity -/+ |
| 19 | KC | same: `PCB_ACTIONS::flipBoard` | Flip board view | **P2** View > Flip field (swap red/blue side perspective) |
| 20 | KC | same: inspectMenu (boardStatistics, measureTool, runDRC, prev/next/excludeMarker) | Inspect menu | **P1** Analysis menu: Match Statistics, Measure, Run Spec Check, Prev/Next Violation, Exclude Violation |
| 21 | KC | same: prefsMenu (configurePaths, openPreferences) + `3d_menubar.cpp` "Reset to Default Settings" | Preferences menu incl. reset | **P1** Preferences > Reset to defaults |
| 22 | FC | `FC/Workbench.cpp`:`StdWorkbench::setupMenuBar` View: `Std_ViewCreate, OrthographicCamera, PerspectiveCamera, MainFullscreen, stdviews, FreezeViews, DrawStyle, SelBoundingBox, zoom, AxisCross, ToggleClipPlane, visu, ToolBarMenu, DockViewMenu, ToggleBottomPanels, ViewStatusBar` | Full View menu skeleton | **P1** Copy ordering: Camera (ortho/persp) / Standard Views ▸ / Draw Style ▸ / Zoom ▸ / Axis cross / Clipping / Visibility ▸ / Toolbars ▸ / Panels ▸ / Status bar |
| 23 | FC | same: `stdviews` "Standard Views" submenu incl. `Axonometric` ▸ (Iso/Dimetric/Trimetric) | Nested view-direction submenu | **P1** View > Standard Views ▸ (see §10) |
| 24 | FC | same: `visu` "Visibility" submenu (ToggleVisibility, Show/HideSelection, SelectVisibleObjects, Toggle/Show/HideObjects, ToggleSelectability) | Visibility ops | **P1** View > Visibility ▸ Hide selected robot / Show all / Isolate selected / Toggle selectable |
| 25 | FC | same: Tools menu (Measure, UnitsCalculator, ViewScreenShot, DemoMode, SceneInspector, DependencyGraph, DlgParameter) | Utility tools | **P2** Tools: Measure, Unit Converter (mm/s ↔ m/s), Screenshot, Turntable, Scene Inspector (debug), Dependency Graph (spec→condition deps), Raw Params |
| 26 | FC | same: Macro menu (Record, Execute, Recent Macros) | Macro recording | **P2** "Record analysis steps" → replayable script of commands (command ids) |
| 27 | FC | same: Windows menu (Next/Prev window, Tile, Cascade) | Window management | skip: single-page app; use tabs + layout presets instead |
| 28 | FC | same: Help (`Std_WhatsThis`, ReportBug, RestartInSafeMode) | What's-this pointer mode | **P2** Help > What's This (click any control → tooltip doc); "Reload without saved layout" = safe mode |
| 29 | FC | `FC/CommandStd.cpp`:`Std_DlgPreferences` accel `Ctrl+,` | Prefs shortcut convention | **P1** Ctrl+, opens Settings (VSC/KC/FC all agree) |

## 2. Toolbars

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 30 | KC | `KC/pcbnew/toolbars_pcb_editor.cpp`:`DefaultToolbarConfig(TOOLBAR_LOC)` LEFT/RIGHT/TOP_MAIN/TOP_AUX | Four toolbars, declaratively configured, user-customizable | **P1** 4 strips: Top-main (file/undo/zoom/run), Top-aux (dropdown controls), Left (view toggles), Right (tools/modes) |
| 31 | KC | same: `TOOLBAR_GROUP_CONFIG("Units")` etc. | Grouped flyout buttons (one icon, long-press/arrow shows siblings, remembers last) | **P1** Group buttons: camera presets, draw styles, measure modes as flyouts |
| 32 | KC | same: LEFT `toggleGrid` + context `ACTION_MENU` (gridProperties, gridOrigin) | Toggle button with right-click menu | **P1** Grid toggle w/ right-click "Grid settings…" on field viewport |
| 33 | KC | same: LEFT `togglePolarCoords` | Polar vs cartesian coords | **P2** Toggle cursor readout polar (r,θ from robot) vs field XY |
| 34 | KC | same: LEFT group "Units" (mm/in/mils) | Units radio group in toolbar | **P1** Units group: m / mm; s / frames |
| 35 | KC | same: LEFT group "Crosshair modes" (small/full/45°) | Cursor style | **P2** Full-viewport crosshair option in top-down ortho view for alignment |
| 36 | KC | same: LEFT `showRatsnest`, `ratsnestLineMode` | Show connection lines | **P1** Show "intent lines" (robot→target) and pass/transfer lines |
| 37 | KC | same: LEFT `highContrastMode`, `toggleNetHighlight` | Dim others / highlight net | **P1** Highlight one robot's whole timeline (net-highlight analogue) |
| 38 | KC | same: LEFT pad/via/track display modes | Outline vs filled per category | **P2** per-category outline: robots / game pieces / zones |
| 39 | KC | same: LEFT `showLayersManager`, `showProperties` (panel toggles at toolbar end) | Panel toggles in toolbar | **P1** End of left strip: toggle Appearance panel, toggle Inspector |
| 40 | KC | same: RIGHT group "Selection modes" (Rect / Lasso) | Selection mode | **P2** Rect/lasso select of states in Graph, of rows in timeline |
| 41 | KC | same: RIGHT `measureTool` (Ctrl+Shift+M) | Measure in toolbar | **P1** Measure tool in viewport (distance between robots / to goal at time t) |
| 42 | KC | same: RIGHT `deleteTool` | Click-to-delete tool | skip: replay is read-only |
| 43 | KC | same: TOP_MAIN zoom cluster (Redraw, In, Out, Fit, Fit objects, Zoom tool) | Zoom cluster | **P1** Viewport top strip: Refresh, +, −, Fit field, Fit robots, Box zoom |
| 44 | KC | same: TOP_MAIN `runDRC` | One-click rule check | **P1** "Run spec check" button → violations list |
| 45 | KC | same: TOP_AUX `AppendControl(trackWidth/viaDiameter/layerSelector/gridSelect/zoomSelect/overrideLocks)` | Dropdown controls embedded in toolbar | **P1** Aux strip: [Robot ▾] [Team ▾] [Grid 0.5 m ▾] [Zoom 100% ▾] [Speed 1x ▾] [Candidate ▾] |
| 46 | KC | same: `PCB_ACTION_TOOLBAR_CONTROLS::currentVariant` | Variant selector | **P1** Scenario/variant selector (which rulebook variant or seed) in top strip |
| 47 | KC | same: `PrepareLayerIndicator` (icon recolored to current layer pair) | Toolbar icon reflects state | **P2** Robot selector icon tinted in robot color |
| 48 | KC | `KC/3d-viewer/3d_viewer/toolbars_3d.cpp` (reload, copy, raytrace, zoom, rotX/Y/Z ±, flip, move ±, ortho, appearance) | 3D viewer toolbar | **P1** Viewport toolbar: Reload, Copy image, HQ render, zoom, rotate ±90°, flip, pan, ortho, appearance (see §10) |
| 49 | FC | `FC/Workbench.cpp`:`setupToolBars` "View" toolbar (FitAll, FitSelection, ViewGroup, AlignToSelection, DrawStyle, Measure) | Compact view toolbar | **P1** Same 6-item set over viewport |
| 50 | FC | same: `individualViews` toolbar (Iso, Front, Top, Right, Rear, Bottom, Left) | View-direction toolbar | **P1** Small vertical strip of 7 view buttons (or NaviCube, §10) |
| 51 | FC | `FC/CommandView.cpp`:`StdCmdViewGroup` | Dropdown "group command" remembering last used | Same as #31 |
| 52 | FC | ACT/FC `Std_ToolBarMenu` | Context menu on toolbar area to toggle each toolbar | **P1** Right-click any toolbar → check list of toolbars |
| 53 | VSC | ACT:`MenuId.EditorTitle` / `EditorTitleRun` | Per-editor title action toolbar (primary icons + "…" overflow) | **P1** Each pane header: 2–4 icons + "…" overflow (e.g. Graph: fit, layout, export) |
| 54 | VSC | `browser/actions/layoutActions.ts` "Editor Actions Position" (Title Bar / Tab Bar / Hidden) | User picks where pane actions live | **P2** Setting: pane actions in header / on hover / hidden |
| 55 | VSC | ACT:`MenuId.ViewTitle` / `ViewContainerTitle` / `PanelTitle` / `SidebarTitle` / `AuxiliaryBarTitle` | Title toolbars for every view/container | **P1** Uniform header toolbar component for all panes |
| 56 | KC | `KC/common/widgets/split_button.cpp` | Split button (action + dropdown) | **P2** "Run search ▾" (run / run with options / rerun last) |

## 3. Activity bar / side bars

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 57 | VSC | `browser/parts/activitybar/activitybarPart.ts` | Vertical icon bar switching sidebar view containers | **P1** Left icon rail: Explorer(runs), Candidates, Conditions, Evaluation, Search, Settings-gear at bottom |
| 58 | VSC | `browser/parts/compositeBarActions.ts` "Show Badge/Hide Badge", "Toggle View Badge" | Numeric/progress badges on icons | **P1** Badges: #violations on Evaluation, spinner on Search while worker runs |
| 59 | VSC | `browser/parts/paneCompositeBar.ts` "Toggle View Pinned", "Hide '{0}'" | Pin/unpin & hide icons via context menu, drag reorder | **P2** Right-click rail → hide/pin entries; drag to reorder |
| 60 | VSC | `browser/parts/globalCompositeBar.ts` Accounts + Manage (gear) | Global items pinned at rail bottom | **P1** Bottom of rail: gear → Settings, Keyboard Shortcuts, Theme, Command Palette |
| 61 | VSC | ACT:`MenuId.ActivityBarPositionMenu` ("Activity Bar Position": Default/Top/Bottom/Hidden) | Rail position incl. top tabs | **P2** Rail as left icons or top tabs |
| 62 | VSC | `browser/parts/compositeBarActions.ts` "Show Icons / Show Labels" | Icon-only or labeled | **P2** compact icon-only by default; labels toggle |
| 63 | VSC | `browser/parts/sidebar/sidebarPart.ts`, `browser/actions/layoutActions.ts` `MoveSidebarLeft/Right`, "Toggle Primary Side Bar Position" | Primary side bar left/right | **P2** Allow side bar right for viewport-dominant layout |
| 64 | VSC | `browser/parts/auxiliarybar/auxiliaryBarPart.ts`, "Maximize Secondary Side Bar" | Secondary side bar (opposite side) | **P1** Right side bar = Inspector (selected robot/state/candidate properties) |
| 65 | VSC | `browser/actions/layoutActions.ts` `workbench.action.moveView`, "Move Focused View", "Reset View Locations" | Move any view between side bar / panel / secondary | **P2** Draggable panes between left/right/bottom docks + "Reset View Locations" |
| 66 | VSC | `browser/parts/views/viewPaneContainer.ts` "Move View Up/Down/Left/Right" | Stacked collapsible view panes inside a container | **P1** Side bar = stack of collapsible sections (Runs / Robots / Filters) |
| 67 | VSC | `browser/parts/views/viewPane.ts` "Collapse All", "Refresh", `viewFilter.ts` "Filter" | Per-view header filter box & collapse all | **P1** Filter input in each list header (candidates, states) |
| 68 | VSC | `contrib/outline/browser/*` "Follow Cursor", "Filter on Type", "Sort By: Position/Name/Category" | Outline view controls | **P1** State list "Follow playhead" toggle; sort by time/name/type |
| 69 | VSC | `contrib/timeline/browser/*` "Filter Timeline", "Load more", per-source filter | Timeline view with source filter & pagination | **P1** Event log view: filter by source (robot1–4, referee, scorer); "Load more" for long logs |
| 70 | KC | `KC/pcbnew/widgets/pcb_net_inspector_panel.cpp` | Tabular inspector with grouping/columns | **P2** "Robot inspector" table (per-robot stats grouped by team) |
| 71 | KC | `KC/pcbnew/widgets/pcb_search_pane.cpp`, `common/widgets/search_pane.cpp` "Zoom to Selection", "Pan to Selection", "Search Hidden Fields" | Search pane with result tabs and auto zoom/pan toggles | **P1** Search pane: tabs per entity (States/Events/Candidates); toggles "Zoom to"/"Pan to" selection in viewport |
| 72 | KC | `KC/common/widgets/properties_panel.cpp` "No objects selected", "%d objects selected", "Basic Properties" | Properties grid that handles multi-select | **P1** Inspector shows "3 objects selected" with common props, mixed values shown as "<varies>" |
| 73 | FC | `FC/Tree.cpp` "Search Objects", "Show Internal Name", "Show Description", "Show Items Hidden in Tree View" | Tree with optional columns & hidden items toggle | **P2** Spec/condition tree: toggle ID column, description column, show disabled conditions |
| 74 | FC | `FC/CommandView.cpp` `Std_TreeSyncView` (T,1), `TreeSyncSelection` (T,2), `TreePreSelection` (T,4), `TreeRecordSelection` (T,5) | Tree↔3D sync options | **P1** Sync toggles: list selection ↔ viewport selection ↔ playhead (each toggle in a "Link" menu) |
| 75 | FC | `FC/CommandView.cpp` `Std_TreeSingleDocument` / `TreeMultiDocument` | Single vs multi document tree | **P2** Explorer shows active run only / all loaded runs |
| 76 | FC | `FC/CommandView.cpp` `Std_TreeCollapse/Expand/SelectAllInstances` | Tree bulk ops | **P2** "Select all occurrences" of a state in the timeline |

## 4. Panels (bottom/dock)

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 77 | VSC | `browser/parts/panel/panelActions.ts` `workbench.action.togglePanel` (Ctrl+J), `closePanel`, `focusPanel` | Bottom panel toggle/focus | **P1** Bottom panel (Timeline/Evaluation/Log tabs) toggled with Ctrl+J |
| 78 | VSC | same: `toggleMaximizedPanel` "Maximize Panel"/"Restore Panel" | Maximize panel over editor | **P1** Maximize bottom panel (tables full-screen) and restore |
| 79 | VSC | same: "Maximizing the panel is only supported when it is center aligned." | Guarded action with explanation | **P2** Disabled-action tooltips explain why |
| 80 | VSC | same: `previousPanelView`/`nextPanelView` | Cycle panel tabs | **P1** Ctrl+PgUp/PgDn cycles panel tabs |
| 81 | VSC | ACT:`MenuId.PanelPositionMenu` (Top/Bottom/Left/Right) | Panel position | **P2** Panel bottom or right |
| 82 | VSC | ACT:`MenuId.PanelAlignmentMenu` (Left/Right/Center/Justify) | Panel spans under side bars or not | **P2** Justify = timeline spans full width under viewport + sidebars (good for scrubbing) |
| 83 | VSC | `panelActions.ts` `movePanelToSecondarySideBar` / `moveSecondarySideBarToPanel` | Bulk move views between docks | skip: covered by #65 |
| 84 | FC | `FC/ReportView.cpp` options menu: Display Message Types (Normal/Log/Warnings/Errors/Critical), "Show Report View On", "Go to End", "Clear", "Save As…" | Log panel with severity filters, auto-show-on-error, save | **P1** "Output" tab: severity filters, auto-open on error, Clear, Save log, Go to end |
| 85 | FC | `FC/PreferencePages/DlgSettingsReportView.ui` "Include a timecode for each entry" + per-severity colors | Timestamps & colors | **P1** Log rows prefixed with match time t=… and wall-clock |
| 86 | FC | `FC/Selection/SelectionView.cpp` "Selection View": search, count label, "Picked object list", ctx: Select Only/Deselect/Zoom Fit/Go to Selection | Dedicated selection list panel | **P1** "Selection" panel listing selected robots/states/rows with Zoom-fit, Deselect, Select-only |
| 87 | FC | `FC/CommandView.cpp` `Std_ToggleBottomPanels` (Ctrl+0) + status bar button | One key hides all bottom docks | **P1** Ctrl+0 / status-bar button hide all bottom panels |
| 88 | FC | `FC/CommandView.cpp` `Std_DockOverlay*` (Toggle Overlay, Transparent, Left/Right/Top/Bottom Ctrl+Arrows, Bypass Mouse T,T) | Docks float translucently over the 3D view | **P1** Overlay mode: side panels float semi-transparent over viewport; Ctrl+←/→ toggles left/right overlay; click-through toggle |
| 89 | FC | `FC/PreferencePages/DlgSettingsUI.ui` Overlay: "Hide tab bar", "Hint show tab bar", "Automatically hide in non-3D view", "Automatically pass through of the mouse wheel" | Overlay fine-tuning | **P2** Overlay settings in Settings > Layout |
| 90 | KC | `KC/common/widgets/wx_infobar.cpp`:`WX_INFOBAR::ShowMessageFor(msg,time)` | Dismissable info bar atop canvas, timed | **P1** Thin infobar above viewport ("Spec changed — re-run evaluation [Run] [x]") |
| 91 | KC | `KC/pcbnew/widgets/panel_constraints.cpp` / `constraint_list_view.cpp` | Constraint list panel | **P1** Conditions panel as list with enable checkbox, status icon, jump-to |

## 5. Status bar

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 92 | VSC | `browser/parts/statusbar/statusbarPart.ts` / `statusbarModel.ts` (`StatusbarAlignment.LEFT/RIGHT`, `priority`) | Left = global/workspace state, right = context of active editor; sorted by priority | **P1** Left: run name, worker status, violations count. Right: playhead t, selected robot, cursor XY, units, FPS |
| 93 | VSC | `statusbarItem.ts` `entry.kind` ('standard','warning','error','prominent','remote','offline') + `backgroundColor` | Semantic coloring of items | **P1** Violation item turns error-colored when >0 |
| 94 | VSC | `statusbarItem.ts` `showProgress` ('loading'/'syncing') | Spinner inside item | **P1** Search worker progress spinner + % in status bar (replaces big SearchProgress block when docked) |
| 95 | VSC | `statusbarActions.ts`:`HideStatusbarEntryAction` "Hide '{0}'", `ToggleStatusbarEntryVisibilityAction` | Right-click status bar → per-item checklist | **P1** Same: user hides items via context menu |
| 96 | VSC | `statusbarActions.ts`:`FocusStatusBarAction` | Keyboard focus into status bar | **P2** a11y: F6 cycles to status bar |
| 97 | VSC | `browser/parts/editor/editorStatus.ts` `status.editor.selection` (Ln/Col), `.mode`, `.encoding`, `.eol`, `.indentation` | Clickable items opening pickers | **P1** Clickable: "t=73.4 s" → Go to Time; "Robot R2" → robot picker; "1.0x" → speed picker; "m" → units picker |
| 98 | VSC | `layoutActions.ts` "Toggle Status Bar Visibility" | Hide status bar | **P2** View > Status Bar toggle |
| 99 | VSC | `notificationsStatus.ts` bell + "Do Not Disturb" icon | Notification bell at far right | **P1** Bell at far right (see §12) |
| 100 | KC | `KC/common/eda_draw_frame.cpp`:`EDA_DRAW_FRAME::UpdateStatusBar` fields: zoom "Z 762000", "X … Y …", "dx dy dist", "grid …", units, current tool, constraint "Constrain to H, V, 45" | Fixed-width fields sized from template strings | **P1** Viewport status fields with fixed widths: Zoom, X/Y, dx/dy/dist from anchor, Grid, Units, Active tool, Snap mode |
| 101 | KC | `eda_draw_frame.cpp` (fields sized via `KIUI::GetTextSize("X 00000.0000 …")`) | Avoid jitter: width reserved for worst case | **P1** Use tabular-nums + min-width per field to stop status bar jitter during playback |
| 102 | KC | `KC/common/widgets/kistatusbar.cpp` `m_warningButton` "View %zu message(s)", "Clear Warnings", `m_backgroundStopButton`, `m_backgroundTxt` | Warning count button, background task text + stop button | **P1** Status bar: "⚠ 3" opens load-warning list; background task label with ■ stop (cancel search) |
| 103 | KC | `actions.cpp`:`ACTIONS::resetLocalCoords` (Space) | Reset relative origin for dx/dy | **P1** Space in measure mode sets local origin; status shows dx/dy/dist |
| 104 | FC | `FC/MainWindow.cpp` status widgets: "Preselection" text, "Input Hints" (`InputHintWidget`), ProgressBar, `DimensionWidget` (unit system button), "Quick Measure", "Bottom Panel Toggle", "Notifications" | Status bar inventory | **P1** Hover text (preselection: "R3 · state=Shoot · t=88.1"), input hints ("LMB orbit · RMB pan · Wheel zoom"), unit button, quick-measure readout |
| 105 | FC | `FC/MainWindow.cpp` `InputHintWidget`, `MainWindow::showHints` | Context-sensitive mouse/key hints | **P1** Hints change with active tool (measure: "Click 2nd point · Esc cancel") |
| 106 | FC | `FC/MainWindow.cpp` `DimensionWidget` (clickable unit system) | Click to change unit system | Same as #97 units |
| 107 | FC | `FC/MainWindow.cpp` `rightSideLabel` "Quick Measure" | Auto-shows distance/angle of current selection | **P1** When 2 robots selected show distance & bearing passively |

## 6. Command palette / Quick open

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 108 | VSC | `contrib/quickaccess/browser/commandsQuickAccess.ts`:`ShowAllCommandsAction` `workbench.action.showCommands` (prefix `>`) | Run any command by name; shows keybinding, category "{0}: {1}" | **P1** Ctrl+Shift+P palette; rows "Category: Title  [Ctrl+K]" |
| 109 | VSC | same: recently used section + `workbench.action.clearCommandHistory` ("This action is irreversible!") | MRU commands on top | **P1** MRU top 5, "Clear command history" |
| 110 | VSC | same: "No matching commands" + "similar commands"/ask-chat fallback | Empty state with fallback | **P2** Empty state suggests "Search states for '…'" |
| 111 | VSC | `contrib/search/browser/anythingQuickAccess.ts` `PREFIX=''` (Ctrl+P) | Go to anything (files + symbols) | **P1** Ctrl+P: jump to run, candidate, state, robot, condition by name |
| 112 | VSC | `contrib/search/browser/symbolsQuickAccess.ts` `PREFIX='#'` | Workspace symbols | **P1** `#` = states/candidates across all runs |
| 113 | VSC | `@` editor symbols, `:` go to line (registered in contrib/codeEditor; outside sparse set, prefixes from `quickAccess` registry) | Symbols in current editor; line number | **P1** `@` = items in focused pane (rows in current table); `:` = go to time ("`:73.5`" → seek to 73.5 s, "`:1:13`" → mm:ss) |
| 114 | VSC | `contrib/quickaccess/browser/quickAccess.contribution.ts` HelpQuickAccessProvider `?` | Lists all prefixes | **P1** `?` lists available prefixes |
| 115 | VSC | `contrib/quickaccess/browser/viewQuickAccess.ts` `PREFIX='view '` | Open any view/panel | **P1** `view ` opens a pane by name |
| 116 | VSC | `browser/parts/editor/editorQuickAccess.ts` `edt `, `edt mru `, `edt active ` | Open editors list (MRU) | **P2** `tab ` → switch open tabs (MRU) |
| 117 | VSC | `contrib/search/browser/quickTextSearch/textSearchQuickAccess.ts` `%` | Quick text search in palette | **P2** `%` full-text search over event log |
| 118 | VSC | `browser/parts/titlebar/commandCenterControl.ts`, ACT:`MenuId.CommandCenter` | Search box in title bar opening quick access | **P1** Center title bar search field ("Search runs, states, commands…") |
| 119 | VSC | `layoutActions.ts` `alignQuickInputTop/Center` | Palette position | skip: keep top |
| 120 | VSC | `browser/actions/quickAccessActions.ts` (quickOpenNavigateNext/Previous, select & keep open) | Keyboard nav in quick open, Ctrl+P repeated cycles | **P2** Hold Ctrl, press P repeatedly to cycle MRU |
| 121 | KC | `common/dialogs/hotkey_cycle_popup.cpp`:`HOTKEY_CYCLE_POPUP::Popup` | Transient popup when cycling presets via hotkey (Ctrl+Tab layer presets) | **P1** Ctrl+Tab cycles view presets, small popup shows list w/ highlight |
| 122 | FC | `FC/CommandStd.cpp` `Std_CommandLine` | Command line in console | skip: palette covers it |

## 7. Settings

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 123 | VSC | `contrib/preferences/browser/settingsEditor2.ts` (search box + TOC tree + settings tree) | Searchable settings UI with left TOC | **P1** Settings page: search on top, TOC left (Viewport, Playback, Analysis, Tables, Layout, Keyboard) |
| 124 | VSC | same: "{0} Settings Found" / "No Settings Found" | Live result count | **P1** Show match count |
| 125 | VSC | `contrib/preferences/browser/settingsSearchMenu.ts` filters: `@modified`, `@ext:`, `@feature:`, `@id:`, `@lang:`, `@tag:preview/experimental/advanced` | Filter chips via funnel menu | **P1** Filter funnel: @modified, @tag:experimental, @id: |
| 126 | VSC | `common/preferences.ts`:`MODIFIED_SETTING_TAG` + `settingsTree.ts` modified indicator (left bar) | Blue bar marks non-default settings | **P1** Left accent bar on changed settings |
| 127 | VSC | `settingsTree.ts` gear menu: "Reset Setting", "Copy Setting ID", "Copy Setting as JSON", "Copy Setting as URL" | Per-setting actions | **P1** Per-setting ⋯: Reset, Copy ID, Copy as JSON, Copy link (URL hash) |
| 128 | VSC | settings scope switcher "User / Workspace / Folder / Remote", "Settings Switcher" | Scopes | **P1** Scopes: User (localStorage) vs Run/Project (saved with spec file) |
| 129 | VSC | `settingsEditorSettingIndicators.ts` "Modified elsewhere", "Also modified in", "{0} overrides the default value", "Default value changed" | Cross-scope override indicators | **P1** Show "overridden by project" badge when run-file value shadows user value |
| 130 | VSC | same: "Managed by organization policy", "Requires workspace trust" | Locked settings indicator | skip: no policy layer |
| 131 | VSC | same: "Applies to all profiles", "Sync This Setting" | Profile/sync | skip: no accounts |
| 132 | VSC | `settingsEditor2.ts` "Edit in settings.json" | Escape hatch to raw JSON | **P1** "Edit as JSON" for spec/settings with schema validation |
| 133 | VSC | `settingsTree.ts` "Validation Error." inline | Inline validation | **P1** Inline validation in condition editor fields |
| 134 | VSC | `settingsTree.ts` "Experimental" / "Preview" / "Advanced" tags | Maturity badges per setting | **P2** Tag experimental analysis options |
| 135 | KC | `KC/pcbnew/dialogs/panel_display_options_base.cpp` (Annotations: net names on pads/tracks, pad numbers, clearance outlines; Cross-probing: center/zoom/flash) | Display options page | **P1** Settings > Viewport: robot labels (none/id/state), show clearance circles, path trails length; Cross-probe: "Center view on selection", "Zoom to fit", "Flash selection 3x" |
| 136 | KC | same: "Flash cross-probed selection" ("Temporarily flash the newly cross-probed selection 3 times") | Flash on cross-probe | **P1** When clicking a table row, flash the robot 3x in viewport |
| 137 | KC | `3d-viewer/3d_viewer/eda_3d_viewer_settings.cpp` `camera.animation_enabled`, `camera.moving_speed_multiplier`, `camera.rotation_increment`, `camera.projection_mode` | Camera prefs | **P1** Settings > Camera: animate transitions, speed, rotate step (°), default projection |
| 138 | KC | same: `render.raytrace_*` (shadows, reflections, AA, samples), `render.opengl_highlight_on_rollover`, `opengl_selection_color` | Render quality prefs | **P2** Quality: shadows/AA toggles; hover highlight; selection color |
| 139 | FC | `FC/Dialogs/DlgPreferencesImp.cpp`:`PreferencesSearchController` + searchBox arrow-key navigation | Search across all prefs pages, highlights widget | **P1** Same as #123 |
| 140 | FC | same:`showResetOptions` "Reset Page '%1'", "Reset Group '%1'" | Reset per page / per group | **P1** Reset section / reset all |
| 141 | FC | `FC/PreferencePages/DlgSettingsGeneral.ui` "Preference Packs" (Load, Import Configuration, Save as New) | Saved preference bundles | **P2** Export/import settings bundle (share team presets) |
| 142 | FC | same: "Number of decimals", "Default unit system", "Substitute decimal separator" | Number formatting prefs | **P1** Decimals for time/distance/score columns; unit system |
| 143 | FC | `DlgSettings3DView.ui` "Show coordinate system in the corner", "Show counter of frames per second", anti-aliasing, "Maximum frame rate", Camera Type | 3D view prefs | **P1** Corner axis gizmo, FPS counter toggle, max FPS cap (battery), AA |
| 144 | FC | `DlgSettingsNavigation.ui` Navigation Cube (corner, size, opacity when inactive, rotate to nearest, steps by turn), Orbit style (Turntable/Trackball…), Rotation mode (Window center/Drag at cursor/Object center) | Navigation prefs | **P1** Orbit style: Turntable default; rotate around cursor vs field center; cube corner & inactive opacity |
| 145 | FC | `DlgSettingsSelection.ui` "Enable preselection" (hover highlight color), selection color, pick radius | Selection prefs | **P1** Hover highlight + pick radius (px) for small robots |
| 146 | FC | `DlgSettingsViewColor.ui` background simple/linear/radial gradient | Background prefs | **P2** Viewport background: flat vs gradient; follows theme |
| 147 | FC | `DlgSettingsLightSources.ui` main/back/fill/ambient light with preview | Light editor | skip: overkill; fixed lighting |
| 148 | FC | `DlgSettingsUI.ui` Tree: "Font size", "Icon size", "Resizable columns", "Hide header", "Show visibility icon" | List density prefs | **P1** Density: row height compact/normal; table font size |
| 149 | VSC | `browser/actions/layoutDensityActions.ts` `setLayoutDensity.Default/Compact` | Global density switch | **P1** Global Compact/Default density toggle |

## 8. Keybindings

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 150 | VSC | `contrib/preferences/browser/keybindingsEditor.ts` table cols Command / Keybinding / When / Source | Searchable keybinding table | **P1** Shortcuts page with Command, Key, When (pane context), Source (default/user) |
| 151 | VSC | same: `recordKeysAction` "Record Keys" | Search by pressing keys | **P1** "Record keys" toggle in shortcut search |
| 152 | VSC | same: `sortByPrecedenceAction` "Sort by Precedence (Highest first)" | Precedence ordering | **P2** Sort by precedence |
| 153 | VSC | `keybindingWidgets.ts` "Press desired key combination and then press ENTER.", "{0} existing commands have this keybinding", "chord to" | Define-key overlay with live conflict count; chords | **P1** Capture overlay shows conflicts live; clicking count filters table |
| 154 | VSC | `keybindingsEditor.ts` ctx: "Change When Expression", "Remove", "Reset", "Show Same Keybindings", "Copy Command ID" | Row actions | **P1** Row ⋯: Change, Remove, Reset, Show conflicts, Copy ID |
| 155 | VSC | `When` clause (context keys, e.g. `focusedView == 'graph'`) | Context-scoped bindings | **P1** Context keys: `viewportFocus`, `graphFocus`, `tableFocus`, `editorFocus`, `isPlaying` — lets Space=play in viewport but not in editor |
| 156 | KC | `common/widgets/widget_hotkey_list.cpp` "Hotkey conflict", "Edit Alternate…", "Clear Assigned Alternate", "Restore Defaults", "Undo Changes" | Primary + alternate hotkey per action; conflict dialog | **P2** Allow one alternate key per command |
| 157 | KC | `common/dialogs/panel_hotkeys_editor.cpp` "Import Hotkeys…", "Undo All Changes", "Type filter text" | Import/export hotkey sets | **P2** Import/export keymap JSON |
| 158 | KC | `actions.cpp`:`ACTIONS::listHotKeys` (Ctrl+F1) | Read-only hotkey cheat sheet | **P1** Ctrl+F1 or `?` overlay listing shortcuts for focused pane |
| 159 | FC | `FC/CommandView.cpp` two-stroke accels "V,1".."V,7", "V,O", "V,P", "T,1".., "S,B" | Mnemonic chord families (V=view, T=tree, S=selection) | **P1** Chord families: V,F fit; V,O ortho; V,P persp; V,1..7 draw styles; G,… go-to |
| 160 | KC | `actions.cpp` `cursorUp/Down/Left/Right` + Fast (Ctrl) and `panUp…` (Shift+arrows) | Arrow-key cursor & pan | **P1** ←/→ step 1 frame, Ctrl+←/→ step 1 s, Shift+←/→ jump event; in viewport Shift+arrows pan |

## 9. Context menus

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 161 | VSC | ACT:`MenuId.EditorTitleContext` / `EditorTabsBarContext` + `editorCommands.ts` "Close", "Close Others", "Close to the Right", "Close Saved", "Close All", "Keep Open", "Pin/Unpin", "Split Right/Down", "Copy Path" | Tab context menu | **P1** Pane-tab context: Close / Close others / Pin / Split right / Split down / Move to panel / Copy link |
| 162 | VSC | `editorCommands.ts` "Lock Group", "Maximize Group" | Lock group, maximize group | **P2** Lock pane (don't follow selection) — useful for comparing two candidates |
| 163 | VSC | ACT:`MenuId.ExplorerContext` (+ `ExplorerContextShare`) | Explorer item context | **P1** Run list context: Open, Open to side, Compare with…, Rename, Duplicate, Export, Delete |
| 164 | VSC | ACT:`MenuId.ViewItemContext` / `ViewTitleContext` | Per-item and per-header context in any view | **P1** Same component for all lists |
| 165 | VSC | ACT:`MenuId.TimelineItemContext`, `TimelineFilterSubMenu` | Timeline item context & filter submenu | **P1** Timeline event context: Seek here, Set loop start/end, Bookmark, Copy timestamp |
| 166 | VSC | ACT:`MenuId.TitleBarContext` "Toggle visibility of Command Center / Layout Controls / Navigation Controls" | Title bar customization | **P2** Right-click title bar → show/hide search, layout buttons |
| 167 | VSC | ACT:`MenuId.StatusBarWindowIndicatorMenu` | Status bar item menu | see #95 |
| 168 | FC | `FC/Workbench.cpp`:`setupContextMenu("View")` (FitAll, FitSelection, AlignToSelection, DrawStyle, Standard Views ▸, Document Window; with sel: ToggleVisibility, Selectability, Go to Selection (tree), RandomColor, ToggleTransparency, Delete) | Viewport context menu, varies with selection | **P1** Viewport RMB: (no sel) Fit, Views ▸, Draw style ▸; (robot sel) Follow camera, Isolate, Hide, Show trail, Reveal in table, Color ▸, Transparency |
| 169 | FC | same: `setupContextMenu("Tree")` (ToggleFreeze, Toggle/Show/HideSelection, Selectability, SelectAllInstances, RandomColor, Transparency, Cut/Copy/Paste/Delete, Send to Python console, Transform, Placement) | Tree item context | **P1** Condition tree RMB: Enable/disable, Duplicate, Copy as JSON, Delete, "Send to console" (debug) |
| 170 | FC | `FC/Tree.cpp` "Mark to Recompute", "Recompute Object", "Skip Recomputes", "Allow Partial Recomputes" | Recompute controls | **P1** Evaluation: mark stale, recompute selected, pause auto-recompute (heavy worker) |
| 171 | FC | `FC/Selection/SelectionView.cpp` ctx "Select Only", "Deselect", "Zoom Fit", "Go to Selection", "To Python Console" | Selection list context | see #86 |
| 172 | KC | `pcbnew/widgets/appearance_controls.cpp` layer ctx: "Show All Layers", "Hide All Layers But Active", "Show Only Front Layers", …; net ctx: "Set Net Color", "Clear Net Color", "Highlight %s", "Select Tracks and Vias in %s", "Hide All Other Nets" | Rich visibility context menus | **P1** Robot row RMB: Show only this, Hide others, Set color, Highlight, Select all its events |
| 173 | KC | `toolbars_pcb_editor.cpp` toolbar buttons with attached `ACTION_MENU` (zone fill/unfill/manager; router modes) | Context menu on toolbar button | **P2** RMB on "Run search" → options |
| 174 | VSC | `browser/actions/listCommands.ts` | Keyboard list navigation (expand/collapse/select range) | **P1** Consistent arrow/Home/End/Shift-select in all tables |

## 10. 3D view controls

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 175 | FC | `FC/NaviCube.cpp`:`NaviCube` `PickId::{Front,Top,Right,…,FrontTopRight,…}` (6 faces + 12 edges + 8 corners) | Clickable orientation cube | **P1** NaviCube top-right of viewport: faces = field side views, corners = iso views; labels "Red/Blue/Audience/…" via `setNaviCubeLabels` |
| 176 | FC | same: `PickId::ArrowNorth/South/East/West`, `ArrowLeft/Right` | Orbit/rotate arrows around cube | **P1** Arrows rotate 15°/90° (setting `setNaviStepByTurn`) |
| 177 | FC | same: `PickId::Home`, `PickId::ViewMenu` (`NaviCube_Menu`), `PickId::Backside` | Home button, mini menu (ortho/persp, zoom fit), flip to back | **P1** Home + mini ▾ menu (ortho/persp, fit) on cube |
| 178 | FC | `NaviCube.h` `setCorner`, `setSize`, `setInactiveOpacity`, `setDraggable`, `setShowCS` | Cube placement/opacity | **P1** Fades when not hovered (inactive opacity 0.5) |
| 179 | FC | `CommandView.cpp` `Std_ViewHome` (Home), `ViewFront`(1) `ViewTop`(2) `ViewRight`(3) `ViewRear`(4) `ViewBottom`(5) `ViewLeft`(6) `ViewIsometric`(0) | Numeric view hotkeys | **P1** 0–6 number keys for views in viewport focus (bottom → "Broadcast cam") |
| 180 | FC | `Std_ViewDimetric`, `Std_ViewTrimetric` | Axonometric variants | skip: iso enough |
| 181 | FC | `Std_ViewRotateLeft/Right` (Shift+←/→) | Rotate 90° about view axis | **P2** Rotate top view 90° (field portrait/landscape) |
| 182 | FC | `Std_OrthographicCamera` (V,O) / `Std_PerspectiveCamera` (V,P) | Projection toggle | **P1** Ortho toggle (top-down analysis must be ortho) |
| 183 | KC | `3d-viewer/3d_viewer/tools/eda_3d_actions.cpp`:`toggleOrtho` | Same | same |
| 184 | FC | `Std_ViewFitAll` (V,F) / `Std_ViewFitSelection` (V,S) | Fit | **P1** F = fit field, Shift+F/V,S = fit selection |
| 185 | FC | `Std_AlignToSelection` | Camera looks at selected element normal | **P2** "Look from robot" (camera at robot pose) |
| 186 | FC | `Std_StoreWorkingView` (Shift+End) / `Std_RecallWorkingView` (End); `Std_ViewSaveCamera/RestoreCamera` | Temporary camera bookmark | **P1** Save/recall camera bookmark (1 slot + named list) |
| 187 | KC | `pcbnew/widgets/appearance_controls.cpp` "Viewports" "Save viewport…", "Delete viewport…", "Viewports (%s+Tab)" | Named saved viewports, cycle with Shift+Tab | **P1** Named camera bookmarks list in Appearance panel; cycle with hotkey + popup (#121) |
| 188 | FC | `Std_FreezeViews` (Shift+F) | Freeze display / save view snapshots | skip: bookmark covers it |
| 189 | FC | `StdCmdDrawStyle` V,1..V,7: As-is, Points, Wireframe, Hidden line, No shading, Shaded, Flat lines | Draw style group | **P1** Draw styles: Shaded, Flat (no lighting), Wireframe/outline, Silhouette-only; V,1..4 |
| 190 | FC | `Std_ToggleClipPlane` + `Clipping.ui` (Clip X/Y/Z, Offset, Flip, Custom direction, "Adjust to view direction") | Section/clipping planes | **P2** Height clip (Z) slider to see robots under structures; flip |
| 191 | FC | `Std_AxisCross` (A,C) + `DlgSettings3DView` "Show coordinate system in the corner" | Origin axes / corner triad | **P1** Corner XYZ triad + optional field origin axes |
| 192 | FC | `Std_SelBoundingBox` | Draw bbox of selection | **P2** Show robot bbox/footprint rectangle (collision check) |
| 193 | KC | `eda_3d_actions.cpp` `showBBoxes` "Show Model Bounding Boxes" | Same | same |
| 194 | FC | `Std_ViewBoxZoom` (Ctrl+B) | Box zoom | **P1** Box zoom in viewport |
| 195 | KC | `actions.cpp` `zoomIn/Out` at cursor (F1/F2), `zoomCenter` (F4), `zoomUndo/zoomRedo` | Zoom at cursor, center on cursor, zoom history | **P1** Zoom history back/forward (Alt+←/→ in viewport) |
| 196 | FC | `Std_DemoMode` "View Turntable" + `DemoMode.ui` (Angle, Speed, Enable timer, Play, Fullscreen) | Auto-rotate turntable | **P2** Presentation turntable for screenshots |
| 197 | FC | `Std_ViewScreenShot` "Save Image…" | Screenshot | **P1** Export PNG of viewport at chosen resolution |
| 198 | KC | `eda_3d_actions.cpp` `copyToClipboard`, `exportImage` | Copy 3D image to clipboard | **P1** Copy viewport image (for Slack) |
| 199 | KC | `eda_3d_actions.cpp` `toggleRaytacing` "Use raytracing" | Switch to slow high-quality renderer | **P2** "HQ render" (shadows/AA) only when paused |
| 200 | KC | `eda_3d_actions.cpp` `rotateX/Y/ZCW/CCW` (R / Shift+R for Z) | Fixed-step rotation | **P1** R / Shift+R rotate view about vertical axis by step |
| 201 | KC | `eda_3d_actions.cpp` `moveLeft/Right/Up/Down` (arrows) | Pan by step | **P2** (conflicts with time stepping → use Shift+arrows) |
| 202 | KC | `eda_3d_actions.cpp` `flipView` (F) | Flip to other side | **P2** Swap alliance perspective |
| 203 | KC | `eda_3d_actions.cpp` `pivotCenter` (Space / middle click) "Set Pivot" | Set orbit pivot under cursor | **P1** Middle-click sets orbit pivot (show pivot sphere, cf. FC "Rotation Center Indicator") |
| 204 | KC | `eda_3d_actions.cpp` `viewFront`(Y) `viewBack`(Shift+Y) `viewLeft`(Shift+X) `viewRight`(X) `viewTop`(Z) `viewBottom`(Shift+Z), `homeView` (Home) | Axis-letter view keys | skip: choose FC number scheme (#179) to avoid letter conflicts |
| 205 | KC | `3d_menubar.cpp` gridSubmenu `noGrid/show10mmGrid/5mm/2_5mm/1mm` | 3D grid preset radio | **P1** Field grid: none / 1 m / 0.5 m / 0.25 m |
| 206 | KC | `eda_3d_actions.cpp` `materialNormal/Diffuse/CAD` | Material mode | **P2** Material: realistic / flat team colors / CAD (high contrast) |
| 207 | KC | `eda_3d_actions.cpp` `showNavigator` "Show 3D Navigator" | Toggle orientation gizmo | **P1** Toggle NaviCube/triad |
| 208 | KC | `eda_3d_actions.cpp` `reloadBoard` "Reload board and refresh 3D view" | Reload | **P1** Reload run data without page refresh |
| 209 | FC | `FC/Navigation/NavigationStyle.cpp` + `Navigation/*NavigationStyle.cpp` (Blender, CAD, Gesture, Maya, OpenSCAD, Revit, SiemensNX, SolidWorks, TinkerCAD, Touchpad…) | Selectable mouse-navigation schemes | **P2** Nav style picker: "Default (Three OrbitControls)", "Blender-like", "Touchpad"; show mapping in status hints |
| 210 | FC | `Std_ToggleNavigation` (Esc) | Navigation vs edit mode | **P1** Esc exits tool (measure) back to navigate |
| 211 | FC | `Std_ViewIvIssueCamPos` | Print camera position | **P2** "Copy camera as JSON" (reproducible screenshots / links) |
| 212 | FC | `Std_ViewDockUndockFullscreen` (V,D / V,U / F11) | Dock/undock/fullscreen a 3D view | **P1** Pop viewport out to fullscreen (F11) or new window |
| 213 | FC | `Std_ViewCreate` "New 3D View" | Second view of same doc | **P2** Second viewport (top ortho + chase cam), synced playhead |

## 11. Selection / visibility filters

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 214 | KC | `pcbnew/widgets/panel_selection_filter.cpp` checkboxes: All items, Locked items, Footprints, Text, Tracks, Vias, Pads, Graphics, Zones, Rule Areas, Dimensions, Points, Other | Which categories are pickable | **P1** Selection filter panel: ☑ All ☑ Robots ☑ Game pieces ☑ Zones ☑ Trails ☑ Annotations ☐ Field structure |
| 215 | KC | same: "Allow selection of locked items" | Locked-item pickability | **P2** Field geometry locked/unpickable by default |
| 216 | KC | `appearance_controls.cpp` tabs Layers / Objects / Nets | Appearance panel tabs | **P1** Appearance panel tabs: Layers (field, zones, trails, labels) / Objects / Robots |
| 217 | KC | same: per-row eye toggle "Show or hide %s", swatch "Double click … to change color" | Visibility + color per row | **P1** Each row: 👁 toggle, color swatch, opacity |
| 218 | KC | same: Objects `RR(...)` rows with opacity sliders ("Tracks","Vias","Pads","Zones","Filled Shapes","Images") "Set opacity of %s" | Per-category opacity sliders | **P1** Opacity sliders: Robots, Trails, Zones, Heatmap, Field mesh |
| 219 | KC | same: Objects rows "Footprints Front/Back", "Values", "References", "Ratsnest", "DRC Warnings/Errors/Exclusions", "Anchors", "Locked Item Shadow", "Colliding Courtyards", "Grid" | Annotation/overlay toggles | **P1** Toggles: robot labels, state labels, intent lines, spec violations (err/warn/excluded), origins, collision halos, grid |
| 220 | KC | same: "Presets (%s+Tab)", "Save preset…", "Delete preset…", "Default presets cannot be modified" | Visibility presets, built-ins locked | **P1** Presets: "All", "Red only", "Blue only", "Robot focus", "Violations"; user-saved; Ctrl+Tab cycles |
| 221 | KC | same: "Inactive layers: Normal / Dim / Hide" (`highContrastModeCycle` H) | 3-state inactive display | **P1** H cycles non-selected robots: normal → dim → hidden |
| 222 | KC | same: Net display "Net colors: All / Ratsnest / None", "Ratsnest display: All layers / Visible layers" | Coloring scope | **P2** Color trails by: team / robot / state / speed |
| 223 | KC | same: "Filter nets" search box in Nets tab | Filter long lists | **P1** Filter box in Robots/States tab |
| 224 | KC | `3d_viewer/tools/eda_3d_actions.cpp` `showTHT`(T) `showSMD`(S) `showVirtual`(V) `showNotInPosFile`(P) `showDNP`(D) | Single-key category visibility in 3D | **P2** Single keys toggle categories in viewport focus (e.g. T trails, L labels) |
| 225 | KC | `eda_3d_viewer_settings.cpp` `render.show_*` (copper, silkscreen, soldermask, zones, comments, eco, fp_values…) | Many 3D layer toggles | see #219 |
| 226 | FC | `CommandView.cpp` `Std_ToggleSelectability` | Toggle object pickable | **P2** Per-robot "not selectable" |
| 227 | FC | `Std_ShowSelection`/`HideSelection`/`ToggleVisibility`(Space)/`SelectVisibleObjects`/`ShowObjects`/`HideObjects` | Show/hide ops | **P1** Hide selected / Show all / Isolate (Space conflicts with play — rebind to H/Alt+H) |
| 228 | FC | `Std_ToggleTransparency` (V,T) | Make selection transparent | **P2** Ghost selected robot (see through) |
| 229 | FC | `Std_SelBack` (S,B) / `Std_SelForward` (S,F) | Selection history navigation | **P1** Selection back/forward (Alt+←/→ global) |
| 230 | FC | `Std_BoxSelection` (Shift+B), `Std_BoxElementSelection` (Shift+E) | Box select | **P2** Box select robots / trail samples |
| 231 | FC | `Std_ClarifySelection` (G,G) | Disambiguation picker for overlapping items | **P1** When click hits overlapping robots/pieces, popup list to choose (cf. KC "selectionMenu") |
| 232 | KC | `actions.cpp` `selectionMenu` / `ACTIONS::selectionClear` | Clarification menu on ambiguous click | same |
| 233 | FC | `DlgSettingsSelection.ui` "Enable preselection" | Hover highlight | **P1** Hover highlight robots and graph nodes, linked across panes |

## 12. Notifications

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 234 | VSC | `browser/parts/notifications/notificationsToasts.ts` `MAX_NOTIFICATIONS=3`, `MAX_WIDTH=450`, `PURGE_TIMEOUT` per severity | Max 3 toasts bottom-right, auto-hide info, errors stay | **P1** Toast stack (max 3); info auto-hides ~10 s; errors persist |
| 235 | VSC | `notificationsCenter.ts` "Notifications Center", "Clear All Notifications", "Hide Notifications", "No New Notifications" | History list of all notifications | **P1** Notification center from bell: list, Clear All, collapse |
| 236 | VSC | `notificationsCommands.ts` "Expand/Collapse Notification", "Copy Text", "Clear Notification" | Per-notification actions | **P1** Copy text (bug reports), expand details (stack) |
| 237 | VSC | `notificationsStatus.ts`/`notificationsCommands.ts` "Toggle Do Not Disturb Mode", "Toggle Do Not Disturb Mode By Source…" | DND, per-source mute | **P1** DND during presentation; mute per source (worker, loader) |
| 238 | VSC | same: "Turn Off Info and Warning Notifications from '{0}'" | Mute from toast | **P2** "Don't show again for this type" |
| 239 | VSC | ACT:`MenuId.NotificationsCenterPositionMenu` "Configure Notifications Position…" | Corner choice | skip: fixed bottom-right |
| 240 | VSC | `notificationsToasts.ts` progress notifications | Toast with progress bar & cancel | **P1** Long search: toast with progress + Cancel button |
| 241 | VSC | `browser/parts/banner/bannerPart.ts` | Full-width banner above workbench | **P2** Banner for "Viewing stale results — data changed" |
| 242 | FC | `FC/NotificationArea.cpp` "Delete", "Delete User Notifications", "Delete All"; params `MaxOpenNotifications`, `MinimumOnScreenTime`, `NotificationTime`, `HideNonIntrusiveNotificationsWhenWindowDeactivated`, `AutoRemoveUserNotifications` | Status-bar notification area with tunables | **P2** Settings > Notifications: duration, max open, auto-remove |
| 243 | FC | `DlgSettingsNotificationArea.ui` "Debug errors", "Debug warnings" (developer sources) | Developer-only notification source | **P2** Dev toggle: show worker debug warnings |
| 244 | KC | `common/widgets/kistatusbar.cpp` "View load messages" | Load-time warnings collected into one button | **P1** Data-load warnings (missing frames, clamped values) aggregated, not spammed |

## 13. Layout

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 245 | VSC | `browser/actions/layoutActions.ts` `workbench.action.customizeLayout` "Customize Layout…" (Visibility / Primary Side Bar Position / Panel Alignment / Quick Input Position / Modes / Layout Density) | One quick-pick with all layout toggles | **P1** "Customize Layout" popover from title-bar layout icon |
| 246 | VSC | same: `CreateToggleLayoutItem` (Menu Bar, Activity Bar, Primary Side Bar, Secondary Side Bar, Panel, Status Bar) | Title-bar layout control buttons (`MenuId.LayoutControlMenu`) | **P1** Title bar right: 3 icons toggle Left bar / Bottom panel / Right bar (VS Code style) |
| 247 | VSC | same: `workbench.action.toggleZenMode` | Hide all chrome, focus editor | **P1** Zen = viewport + timeline only (Ctrl+K Z), Esc Esc exits |
| 248 | VSC | same: `toggleCenteredLayout` | Centered content | skip: wide 3D view benefits from full width |
| 249 | VSC | same: `toggleFullScreen` | Full screen | **P1** F11 browser fullscreen API |
| 250 | VSC | same: `toggleEditorVisibility` "Toggle Editor Area Visibility" | Hide main area, panels fill | **P2** Hide viewport → tables-only analysis mode |
| 251 | VSC | same: `increaseViewSize/Width/Height`, `decreaseViewSize…` | Keyboard resize of panes | **P2** Ctrl+Alt+arrows resize focused pane |
| 252 | VSC | same: `resetViewLocations` | Restore default layout | **P1** View > Reset Layout |
| 253 | VSC | same: "Tab Bar" submenu (Multiple Tabs / Single Tab / Hidden) | Tab bar modes | **P2** Pane groups: tabs vs single title |
| 254 | VSC | `browser/parts/editor/editorGroupWatermark.ts` (Show All Commands, Go to File, Open Recent… with keys) | Empty-state watermark listing key commands | **P1** Empty viewport/no-run watermark: "Open run Ctrl+O · Command palette Ctrl+Shift+P · Recent Ctrl+R" |
| 255 | VSC | `browser/parts/editor/breadcrumbsControl.ts` "Breadcrumbs", "Focus and Select Breadcrumbs", "Copy Breadcrumbs Path", per-segment picker | Path bar with dropdown pickers | **P1** Breadcrumb under title: Run ▸ Candidate #12 ▸ Robot R2 ▸ State "Climb" ▸ t=143.2; each segment dropdown lists siblings |
| 256 | VSC | `editorCommands.ts` Split Right/Down, "Join in Group", "Maximize Group" | Split editor grid | **P1** Split pane to compare two candidates side-by-side (shared playhead toggle) |
| 257 | VSC | `browser/parts/editor/modalEditorPart.ts` (ACT `ModalEditorTitle`) | Modal overlay editor | **P2** Open condition editor as modal over viewport |
| 258 | FC | `CommandView.cpp` `Std_MainFullscreen` (Alt+F11) vs `Std_ViewFullscreen` (F11) | App fullscreen vs single view fullscreen | **P1** F11 viewport-only fullscreen; Alt+F11 whole app |
| 259 | FC | `FC/DockWindowManager.cpp` + `Std_DockViewMenu` "Panels" checklist | Dock list with check toggles | see #16 |
| 260 | KC | `pcbnew/menubar_pcb_editor.cpp` `ACTIONS::show3DViewer` (Alt+3) | Open 3D viewer as separate frame | **P2** Alt+3 pop-out viewport window (`window.open` + BroadcastChannel sync) |
| 261 | VSC | ACT:`MenuId.EditorTabsBarShowTabsZenModeSubmenu` | Zen-specific tab policy | skip: minor |
| 262 | VSC | ACT:`MenuId.TouchBarContext`, `MenuId.IssueReporter`, chat/notebook/SCM/debug/test/tunnel menus | Domain-specific menus | skip: no equivalent domain (chat/SCM/debug not in scope) |

---

### Top recommendations (P1 shortlist for density)
1. Command registry → menus + palette (`>`, `#`, `@`, `:`time, `?`) + keybindings with `when` contexts (VSC ACT/MenuId; quickAccess; keybindingsEditor).
2. Status bar with fixed-width fields (KC `UpdateStatusBar`) + clickable pickers (VSC `editorStatus`) + hover/input hints (FC `InputHintWidget`) + bg-task stop button (KC `kistatusbar`).
3. Appearance panel (KC `appearance_controls`): per-row eye/color/opacity, presets with Ctrl+Tab cycle popup, H for normal/dim/hide; selection filter panel (KC `panel_selection_filter`).
4. 3D: NaviCube with custom field labels + numeric view keys (FC), ortho toggle, camera bookmarks/viewports, draw-style chord V,n, measure tool with local origin (KC).
5. Layout: title-bar layout toggles, Customize Layout popover, Zen, maximize panel, overlay docks (FC DockOverlay), breadcrumbs with sibling pickers; notifications max-3 toasts + center + DND.
