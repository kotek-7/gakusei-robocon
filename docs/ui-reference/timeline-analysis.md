# Peripheral UI reference: timeline / analysis / simulation OSS tools

Scope: peripheral chrome only (menus, toolbars, transport, ruler, markers, lane headers, overlays, A/B, linking, docking, settings, status bar, prefs, keys). Every item was read from source in shallow sparse clones under `scratchpad/oss/`:
- **KD** = Kdenlive (`KDE/kdenlive` master): `src/kdenliveui.rc`, `src/mainwindow_actions.cpp`, `src/timeline2/view/qml/*`, `src/monitor/*`
- **OBS** = OBS Studio (`obsproject/obs-studio` master): `frontend/forms/*.ui`, `frontend/widgets/*`
- **PV** = ParaView (`Kitware/ParaView` master): `Qt/ApplicationComponents/*`, `Qt/Components/pqViewFrame.cxx`, `pqTabbedMultiViewWidget.cxx`
- **LB** = Lichtblick (Foxglove Studio OSS fork, `lichtblick-suite/lichtblick` main): `packages/suite-base/src/...`
- **RV** = RViz2 (`ros2/rviz` rolling): `rviz_common/src/rviz_common/*`

Our app vocabulary: **match** = 180 s replay; **robots** = R-T, R-B, B-T, B-B (red/blue transporter/builder); **lanes** = robot activity swimlanes; **score chart**; **graph** = state-transition graph; **candidates** = candidate strategies; **A/B** = two match paths compared.

Format: `Tool | source file:symbol | function | -> mapping (or skip: reason)`. Items marked ★ are high priority.

---

## 1. Transport / playback bar

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 1 ★ | LB | `components/PlaybackControls/index.tsx:PlaybackControls` (title "Play"/"Pause") | One play/pause toggle with a state-dependent tooltip | -> single Play/Pause button; tooltip shows the key (Space) |
| 2 ★ | LB | `PlaybackControls/index.tsx` "Seek backward"/"Seek forward" + `sharedHelpers.ts:jumpSeek` | Step seek; default 100 ms, Shift = 10 ms (fine), Alt = big step; step size configurable | -> step buttons: default 1 s, Shift = 0.1 s (one sim tick), Alt = 10 s |
| 3 ★ | LB | `PlaybackControls/index.tsx` "Loop playback", `RepeatAdapter.tsx:RepeatAdapter` | Loop toggle; turning it on at the end restarts from the start | -> Loop toggle; loops the playback range (item 9) when one is set |
| 4 ★ | LB | `components/PlaybackSpeedControls.tsx:SPEED_OPTIONS` | Speed dropdown `[0.01 … 0.5, 0.8, 1, 2, 3, 5]`, saved in the layout config | -> speed menu 0.1/0.25/0.5/1/2/4/8x, saved per layout |
| 5 ★ | LB | `PlaybackControls/UnconnectedPlaybackTimeDisplay.tsx:PlaybackTimeMethodMenu` | Editable time field; menu switches format between Time of Day (TOD) and Seconds (SEC) | -> time field accepting `mm:ss.t` or seconds; toggle between elapsed and remaining time (e.g. "T-0:42") |
| 6 ★ | LB | `PlaybackControls/Scrubber.tsx:Scrubber` | Scrub slider whose tooltip stays visible while dragging outside the bar | -> scrubber with a sticky time tooltip during drag |
| 7 | LB | `PlaybackControls/PlaybackBarHoverTicks.tsx` | Hover tick on the bar with the time at the cursor | -> hover ghost-playhead showing the time and score at that time |
| 8 ★ | LB | `PlaybackControls/ProgressPlot.tsx:ProgressPlot` | Loaded/buffered ranges drawn as a striped background | -> show which part of the path has been simulated or computed (useful for lazy candidate evaluation) |
| 9 | LB | `PlaybackControls/EventsOverlay.tsx:EventTick` | Event ticks drawn on the scrub bar | -> scoring/foul/state-change ticks colored by robot on the scrub bar |
| 10 | LB | `PlaybackControls/index.tsx` "Create event" | Button that creates a user event at the current time | -> "Add annotation at playhead" (alias of the marker key M) |
| 11 | LB | `PlaybackControls/PlaybackControlsTooltipContent.tsx` | Tooltip on the time display showing Date/Time/SEC plus metadata | -> tooltip with match time, phase, and the scores of both teams |
| 12 | LB | `PlaybackControls/SwitchSyncInstances/SyncInstanceToggle.tsx` | Sync playback across app instances | -> sync playhead between two browser tabs or windows (A/B on two monitors); low priority |
| 13 ★ | PV | `Resources/UI/pqVCRToolbar.ui` actions First/Reverse/Previous/Play/Next/Last/Loop | Classic VCR set that includes **Reverse play** | -> include reverse play (useful for "what led to this") |
| 14 | PV | `pqTimeManagerWidget.ui` `nbOfFramesValue`, `strideStep` | Frame count and stride for playback | -> "Tick stride" option (play every Nth sim step) for fast skim |
| 15 | PV | `Qt/Components pqAnimationTimeWidget.ui` timeValueComboBox + timestepValue + "max is N" | Time combo plus a step-index spinbox showing the max step | -> dual readout: seconds plus sim step `#1234 / 1800` |
| 16 ★ | KD | `monitor/monitor.cpp:Monitor::slotForward/slotRewind`, `MonitorManager::speedArray` | J/L pressed repeatedly cycle through shuttle speeds; K pauses | -> J/K/L shuttle (see §13) |
| 17 | KD | `monitor/view/ProjectMonitor.qml:labelSpeed` | "x2" speed badge shown on the viewport when speed is above 1 | -> speed badge in the 3D viewport corner |
| 18 | KD | `kdenliveui.rc` monitor: `monitor_play_zone`, `monitor_loop_zone`, `monitor_play_zone_cursor` | Play the zone, loop the zone, or play from the cursor to the zone end | -> "Play range", "Loop range", "Play from here to range end" |
| 19 | KD | `kdenliveui.rc` Go To: seek_start/end, seek_zone_start/end, guide back/fwd, snap back/fwd | Hierarchical go-to menu | -> Go menu: Start, End, Prev/Next marker, Prev/Next event (any lane), Range In/Out |
| 20 | KD | `kdenliveui.rc` Seek: ±1 frame, ±1 second | Fixed-quantum seeks | -> ←/→ = 1 tick, Shift+←/→ = 1 s (see §13) |
| 21 | KD | `mainwindow_actions.cpp` `focus_timecode` (key `=`) | Shortcut that focuses the timecode field to type a time | -> `=` (or Ctrl+G) focuses the time field |
| 22 | KD | `mainwindow_actions.cpp` `align_playhead` (key P) | Move the playhead to the mouse position | -> P = move the playhead to the hovered time in a lane or the score chart |
| 23 | OBS | `OBSBasicControls.ui` record/pause/replayBuffer/saveReplay | Big right-side control column | skip: no live capture. Pattern only: a primary action column with a settings button at the bottom |
| 24 | RV | `time_panel.cpp` "Pause", "ROS Time/Elapsed", "Wall Time/Elapsed" | Shows sim time and wall time side by side | -> status readout of sim time vs wall time when computing candidates live |
| 25 | RV | `time_panel.cpp` "SyncMode"/"SyncSource" | Choose the clock source | -> clock source selector "Path A / Path B / Locked" for A/B (see §6) |

## 2. Timeline header, ruler and zoom

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 26 ★ | KD | `timeline2/view/qml/Ruler.qml:adjustStepSize/adjustFormat` | Tick spacing and label format adapt to zoom (labelMod) | -> ruler at 1 s / 5 s / 15 s / 30 s steps by zoom; label format `m:ss` or `ss.t` |
| 27 ★ | KD | `Ruler.qml` signal `zoomByWheel`; `Timeline.qml:zoomByWheel` | Ctrl+wheel zooms, centred on the cursor; plain wheel scrolls | -> same; Shift+wheel scrolls lanes vertically |
| 28 ★ | KD | `Timeline.qml:fitZoom`; `kdenliveui.rc` `zoom_fit`, `view_zoom_in/out` | Zoom-to-fit plus step zoom buttons | -> "Fit 180 s" button, +/- buttons, and a zoom slider in the lane header |
| 29 | KD | `Ruler.qml` signal `showRulerMenu` | Right-click on the ruler opens a menu (add guide, zone) | -> ruler context menu: Add marker, Set range in/out, Clear range, Copy time |
| 30 ★ | KD | `Timeline.qml` `centeredplayhead` / `autoScroll` | Option to keep the playhead centred or auto-page-scroll | -> "Follow playhead: Off / Page / Center" toggle |
| 31 | KD | `Timeline.qml` playhead.opacity 0.5 while seeking | Dims the playhead until the seek has rendered | -> dim the playhead while a heavy frame (graph relayout) is pending |
| 32 | KD | `qml/timelineplayhead.cpp` | Triangle playhead head in the ruler | -> triangle head plus a line through all lanes and the score chart |
| 33 | KD | `Ruler.qml:effectZone` | Secondary zone bar for the selected effect's range | -> secondary band showing the selected candidate's active window |
| 34 | KD | `kdenliveui.rc` timelineToolBar `timeline_timecode` | Timecode widget inside the timeline toolbar | -> duplicate the time readout at the left of the lane header |
| 35 | LB | `panels/Plot/VerticalBars.tsx` | Vertical bars at the current time and the hovered time in plots | -> score chart shows both the playhead and the hover line |
| 36 | LB | i18n `plot.ts: secondsRange "Range (seconds)"` | Rolling window width for plots | -> score chart "Window: full / last 30 s" option |
| 37 | LB | i18n `plot.ts: syncWithOtherPlots` | Sync x-axis zoom across plots | -> sync x-zoom between score chart, lanes, and A/B charts (on by default) |
| 38 | LB | `panels/Plot/Plot.tsx` onDoubleClick=onResetView, "Reset view" | Double-click resets zoom | -> double-click on the ruler or chart = fit |
| 39 | PV | `pqTimelineWidget.h` advanced mode | Hides advanced timeline rows unless advanced mode is on | -> "Advanced" toggle reveals tick-level rows (per-actuator state) |

## 3. Markers, guides and zones/ranges

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 40 ★ | KD | `mainwindow_actions.cpp` `add_sequence_marker` (G) "Add/Remove Timeline Marker" | One key toggles a marker at the playhead | -> M adds or removes a marker at the playhead |
| 41 ★ | KD | `kdenliveui.rc` `marker_category_menu` `add_marker_guide_1..10` | Marker categories (colored), each with its own shortcut | -> categories: Score, Foul, Handoff, Stall, Note; keys Shift+1..5 |
| 42 ★ | KD | `Ruler.qml` `isRangeMarker`, `markerDuration`, left/rightResizeHandle | Range markers with draggable ends | -> range annotations (e.g. "B-B blocked 42-55 s") |
| 43 | KD | `Ruler.qml:guideRoot.activated` (position == frame) | Highlights the marker under the playhead | -> highlight the active marker and show its label in the viewport overlay |
| 44 | KD | `kdenliveui.rc` `lock_guides` "Lock Timeline Markers" | Prevents accidental marker drags | -> lock-markers toggle |
| 45 | KD | `kdenliveui.rc` `search_guide` "Search Marker…" | Search markers by text | -> marker search box in the marker list panel |
| 46 | KD | `kdenliveui.rc` `export_guides` | Export markers | -> export markers as CSV/JSON (for team review) |
| 47 | KD | `kdenliveui.rc` `edit_sequence_marker`, `delete_all_sequence_markers` | Edit or delete all | -> marker context menu Edit… / Delete / Delete all in category |
| 48 | KD | `timeline2/view/qml/GuidesMenu.qml` | Popup menu listing guides by comment for a jump | -> "Jump to marker ▾" dropdown in the transport bar |
| 49 ★ | KD | `RulerZone.qml` inLabel/outLabel/durationLabel, trimIn/Out, centerDrag | In/out zone with labels, duration readout, draggable ends and a draggable body | -> playback range band in the ruler with In/Out/duration labels |
| 50 ★ | KD | `kdenliveui.rc` `mark_in`/`mark_out` (I/O), `seek_zone_start` (Shift+I) | Set range in/out; Shift jumps to it | -> I/O set the range; Shift+I/O jump to it |
| 51 | KD | `kdenliveui.rc` `select_timeline_zone` | Select everything inside the zone | -> "Select events in range" -> filters the event table |
| 52 | KD | `kdenliveui.rc` timeline_preview `set/unset/clear_render_timeline_zone` | Mark regions for pre-rendering | -> "Precompute range" for expensive candidate simulation; skip if sim is cheap |
| 53 | LB | `panels/Plot/DeltaMarkerBars.tsx`, i18n `measureMode "Measure delta"`, markerA "P1"/markerB "P2" | Two-point measure mode in a plot that shows Δx/Δy | -> score chart measure mode: Δt and Δscore between P1 and P2; Esc exits (`measureModeEscapeHandler`) |
| 54 | OBS | `OBSBasic_Preview.cpp:addSnapGuide` | Snap guides while dragging | -> snap range ends to events and markers (§4 snap) |

## 4. Track / lane headers

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 55 ★ | KD | `qml/TrackHead.qml` Hide/Show (Shift = all of the same type) | Eye toggle; Shift applies it to every track of that type | -> lane eye: hide robot in lanes and 3D; Shift = whole team |
| 56 ★ | KD | `TrackHead.qml` Lock/Unlock track | Lock against edits | -> lane lock: pin a lane so filters or collapse don't affect it; also "lock robot camera follow" |
| 57 ★ | KD | `TrackHead.qml` Mute/Unmute; `kdenliveui.rc` `switch_track_solo` | Mute and solo | -> **Solo robot**: dims the other 3 in 3D, lanes, and the graph |
| 58 | KD | `TrackHead.qml` Minimize/Expand (Shift = all) | Collapse a lane to a thin strip | -> collapse a lane to a 1-line summary; expanded shows sub-rows (pose, task, carry) |
| 59 | KD | `TrackHead.qml` "Edit track name" (double-click) | Inline rename | -> rename a lane label (e.g. machine nickname) |
| 60 | KD | `TrackHead.qml` "Click to make track active/inactive" | Active track = target for operations | -> active lane = target of "next/prev event" keys |
| 61 | KD | `TrackHead.qml` target toggle | Target for insertion | skip: no editing. Reuse the visual (colored left tab) as the team color bar |
| 62 | KD | `TrackHead.qml` "Toggle track effects" | Bypass effects on one track | -> toggle derived overlays per robot (path trail, ghost) |
| 63 | KD | `kdenliveui.rc` Tracks menu: `fit_all_tracks`, `select_all_tracks`, `switch_all_track_lock` | Bulk lane actions | -> Lanes menu: Fit all lanes to height, Show all, Unsolo all |
| 64 | KD | `qml/AudioLevels.qml` | Meter inside the track head | -> mini sparkline in the lane header (cumulative contribution) |
| 65 | KD | `SubtitleTrackHead.qml` | Special non-media track | -> special "Match events" lane (referee or phase events) above the robot lanes |
| 66 | LB | i18n `settingsEditor.ts` Show All / Hide All, List visible/invisible | Bulk visibility plus visibility filter | -> lane-header menu "Show all / Hide all / List hidden" |

## 5. Monitor / viewport overlays (3D field)

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 67 ★ | KD | `kdenliveui.rc` `monitor_config_overlay`: overlay, tc, fps, markers, audiothumb, clipjobs | Per-item overlay toggles | -> overlay menu: time, FPS, active marker, score, robot labels, task labels |
| 68 | KD | `monitor/view/OverlayStandard.qml`/`OverlayMinimal.qml`/`OverlayCenter.qml`/`OverlayThirds.qml`/`Safe169.qml` | Overlay presets plus composition guides | -> overlay presets "Minimal / Standard / Debug"; field grid/zone guides as an option |
| 69 | KD | `EffectToolBar.qml` "Show Grid", "Show Safe Areas", "Switch Full Screen", "Move Toolbar" | Floating viewport toolbar shown on hover, movable | -> floating 3D toolbar (grid, fullscreen, camera presets) that appears on hover |
| 70 | KD | `MonitorZoomButton.qml` Zoom In/Out/Reset Zoom | Viewport zoom cluster | -> 3D: zoom ± and reset |
| 71 | KD | `ProjectMonitor.qml` hint "Click to play, Double click fullscreen, Wheel/arrows seek, Ctrl wheel zoom" | Discoverable gesture hint | -> one-line gesture hint in the viewport status area |
| 72 | KD | `monitor.cpp` m_background Black/White/Pink/Checkerboard | Viewport background choice | -> background: dark/light/field-texture |
| 73 | KD | `monitor.cpp` m_forceSize "Force 100% / 50% / Free Resize" | Lock viewport size | skip: responsive canvas; only needed for screenshot export size |
| 74 | KD | `kdenliveui.rc` `monitor_scaling` scale_1..16_preview | Preview resolution (perf) | -> render scale 1x/0.5x/0.25x for slow laptops |
| 75 | KD | `kdenliveui.rc` `monitor_multitrack` (F12), `MonitorSplitTracks.qml` | Shows every track in a grid inside one monitor | -> "Multi-cam" 2x2: one follow cam per robot |
| 76 | LB | `ThreeDeeRender/IRenderer.ts` follow modes `follow-pose/position/none` | Camera follows the frame's pose, position only, or is fixed | -> camera follow: Free / Follow robot (position) / Follow robot (heading) |
| 77 | LB | i18n `threeDee.ts` displayFrame, perspective, distance, phi/theta, fovy, near/far, "Reset view" | Camera settings exposed in the settings tree | -> camera section in panel settings plus a Reset view button |
| 78 ★ | LB | i18n `threeDee.ts syncCamera` "Sync the camera with other panels…" | Opt-in camera sync between 3D panels | -> A/B: sync camera between the A and B viewports (default on) |
| 79 | LB | `RendererOverlay.tsx` 2D/3D toggle | Switch to top-down orthographic | -> Top-down 2D vs perspective toggle (top-down = default for strategy) |
| 80 | LB | `RendererOverlay.tsx` "Measure distance"/"Cancel measuring" | Ruler tool in 3D | -> measure tool on the field (distance between robots or to a goal) |
| 81 | LB | `RendererOverlay.tsx` "Click to publish" | Click in the scene to emit a pose | -> "Click to place what-if waypoint" for candidate generation; optional |
| 82 | LB | `ThreeDeeRender/Interactions/HoverTooltip.tsx` | Hover tooltip on 3D entities | -> hover a robot to see its ID, task, carrying, and speed |
| 83 | LB | `ThreeDeeRender/Stats.tsx` (THREE Stats, max ~33 ms) | FPS/ms meter overlay | -> debug FPS overlay (hidden behind the Debug preset) |
| 84 | LB | i18n `threeDee.ts` grid: size, divisions, lineWidth, color; "Add Grid" | Configurable grid layer | -> field grid layer (size and divisions in cm) |
| 85 | LB | i18n `threeDee.ts` labels, labelSize/labelScale | Global label scale | -> robot label size slider |
| 86 | LB | i18n `threeDee.ts` historySize, decayTime | Trail length and decay | -> path trail length (s) and fade |
| 87 ★ | PV | `pqCameraToolbar.ui` Reset, ±X/±Y/±Z, Isometric, Rotate 90° CW/CCW, Zoom to Box, Zoom to Data | Camera preset toolbar | -> camera presets: Top, Red side, Blue side, Isometric, Fit field, Zoom to selected robot |
| 88 | PV | `pqCustomViewpointsToolbar.h` | User-defined camera bookmarks | -> save camera bookmarks (Ctrl+1..4) |
| 89 | PV | `pqCameraUndoRedoReaction.h` | Camera undo/redo separate from data undo | -> camera back/forward (Alt+←/→ in the viewport) |
| 90 | PV | `pqCameraLinkReaction.h` | Link camera with the active view | -> see §6/§7 camera link |
| 91 | OBS | `OBSBasic.ui` `actionPreviewZoomIn/Out/ResetZoom`, `scalingMenu` Window/Canvas/Output | Preview zoom and scale modes | -> viewport "Fit window / 1:1" |
| 92 | OBS | `OBSBasic.ui` `actionLockPreview` | Lock the preview to prevent accidental transforms | -> lock the camera (disable orbit while scrubbing) |
| 93 | OBS | `OBSBasic_Preview.cpp:EnablePreview/DisablePreview`, "PreviewDisabled" | Turn the preview off to save CPU | -> pause 3D render when hidden or lanes-only (perf) |
| 94 | RV | `views_panel.cpp` "Zero" (Z) | Jump the camera to the origin | -> Z key = reset camera |
| 95 | RV | `views_panel.cpp` Save/Remove/Rename views | Saved camera views list | -> camera bookmarks list (same as #88) |
| 96 | RV | `visualization_frame.cpp` "Save &Image" | Screenshot | -> Export PNG of the viewport or the whole layout |
| 97 | PV | `pqSaveScreenshotReaction.h`, `pqSaveAnimationReaction.h` | Screenshot and animation export | -> export a clip (WebM/GIF) of the current range |

## 6. A/B compare

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 98 ★ | OBS | `widgets/OBSBasic_StudioMode.cpp:SetPreviewProgramMode` | Studio mode: Preview (left, editable) vs Program (right, live) | -> **A/B mode**: B = candidate being edited (left), A = reference path (right) |
| 99 ★ | OBS | `OBSBasic_StudioMode.cpp:UpdatePreviewProgramIndicators` ("StudioMode.PreviewSceneName"/"ProgramSceneName") | Labels above each pane naming the scene | -> header over each pane: "A: Baseline (score 85)" / "B: Candidate #3 (score 92, +7)" |
| 100 ★ | OBS | `OBSBasic_Transitions.cpp:TransitionClicked` ("Transition" button) | Promote preview to program | -> "Promote B -> A" (make the candidate the new baseline) |
| 101 ★ | OBS | `OBSBasic_Transitions.cpp:TBarChanged/TBarReleased` | T-bar slider blends preview into program | -> **wipe/blend slider** between A and B in the 3D view (ghost overlay opacity) |
| 102 | OBS | `OBSBasic_StudioMode.cpp:CreateProgramOptions` QuickTransitions.SwapScenes | Swap preview and program after a transition | -> "Swap A↔B" button (key X) |
| 103 | OBS | `CreateProgramOptions` QuickTransitions.DuplicateScene / EditProperties | Edit a copy instead of the live scene | -> "Fork B from A at playhead" (duplicate path and edit from t) |
| 104 | OBS | `OBSBasic_StudioMode.cpp:ProgramViewContextMenuRequested`, `OpenStudioProgramProjector` | Right-click to open the program in a separate window or projector | -> pop out the A or B viewport into its own window |
| 105 | OBS | `OBSBasic.ui` `multiviewProjectorMenu` | Multiview grid of all scenes | -> "Candidates grid": thumbnails of N candidates at the same t; click to load into B |
| 106 ★ | KD | `monitor.cpp:Monitor::slotSwitchCompare` (split effect frei0r.alphagrad; `MonitorSplit.qml`) | Draggable split line comparing with/without an effect | -> split-screen wipe in a single 3D view: left = A, right = B, draggable divider |
| 107 | KD | `kdenliveui.rc` `switch_monitor` (T) | Toggle between the clip and project monitors | -> T toggles the focused pane (A or B) for key commands |
| 108 | PV | `Qt/Components/pqViewFrame.cxx` "Split Horizontal Axis"/"Split Vertical Axis" | Split any view into two | -> A/B as a layout split, not a special mode (reuses docking) |
| 109 | RV | `time_panel.cpp` SyncMode/SyncSource | Pick the master clock | -> A/B time lock: "Same t" / "Align by event" (e.g. align at 1st score) / "Independent" |
| 110 | LB | i18n `plot.ts: delta "Delta"` and `stateTransitions.ts` | Delta readouts | -> diff lane: ΔScore(t)=B−A chart under the score chart |

## 7. Linked views and selection

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 111 ★ | PV | `pqLinkSelectionReaction.h` | Link selection between two sources | -> selecting a graph node highlights its time span in the lanes and the robot pose in 3D |
| 112 ★ | PV | `pqCameraLinkReaction.h`, `pqManageLinksReaction.h` | Camera links plus a manager dialog listing links | -> "Links" popover: Camera A↔B, Time A↔B, Selection ↔ all (checkboxes) |
| 113 ★ | PV | `pqSpreadSheetViewDecorator.ui` `SelectionOnly` "Show only selected elements" | Table filtered to the 3D selection | -> event table "Selected only" toggle |
| 114 | PV | `pqSpreadSheetViewDecorator.ui` Attribute combo, Precision spin, ToggleFixed, ToggleColumnVisibility, Export | Table chrome | -> event table: column chooser, decimal precision, Export CSV |
| 115 | PV | `pqSpreadSheetVisibilityBehavior.h` | Auto-shows the active source in the new spreadsheet | -> new table panel auto-binds to the active path |
| 116 ★ | PV | `pqFindDataWidget.ui` Find Data / Reset / Clear; Freeze, Extract, Plot Over Time | Query builder, then act on the result | -> "Find" (Ctrl+F): query events (robot=B-T, state=Carrying, t>60) -> Highlight / Pin / Plot over time |
| 117 | PV | `pqSelectionEditor.ui` saved selections, Expression, "Activate Combined Selections" | Save and combine named selections | -> saved filters ("all handoffs", "blue stalls") combinable with AND/OR |
| 118 | PV | `pqRenderViewSelectionReaction.h`, `pqChartSelectionReaction.h` (rectangle/polygon) | Selection modes in 3D and charts | -> box-select on the score chart = set the time range; box-select in 3D = select robots |
| 119 | PV | `pqObjectPickingBehavior.h` | Click an object in the view to make it active | -> click a robot in 3D = active lane plus inspector |
| 120 | LB | `ThreeDeeRender/Interactions/Interactions.tsx` OBJECT_TAB_TYPE "Selected object", `ObjectDetails.tsx` | Selected-object inspector inside the 3D panel | -> "Selected" drawer in 3D: robot state at t, current task, graph node id (link) |
| 121 | LB | `Interactions/InteractionContextMenu.tsx` | Context menu when several objects overlap under the click | -> disambiguation menu when robots overlap |
| 122 | LB | `Interactions/TopicLink.tsx` | Link from a selected object to its data source | -> "Show in graph" / "Show in lanes" links from the inspector |
| 123 | KD | `Timeline.qml` rubberSelect (Shift+drag) | Rubber-band multi-select | -> Shift+drag in lanes selects events across robots |

## 8. Panel layout and docking

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 124 ★ | LB | i18n `panelToolbar.ts` Split right / Split down / Fullscreen / Remove panel / Change panel; `PanelToolbar/PanelActionsDropdown.tsx` (vsplit/hsplit/enter-fullscreen/remove) | Per-panel ⋯ menu for a mosaic layout | -> each panel header gets ⋯: Split right, Split down, Maximize, Change to…, Close |
| 125 | LB | `PanelToolbar/ChangePanelMenu.tsx`, `components/PanelCatalog/*` | Swap panel type in place; catalog grid/list | -> "Add panel" catalog: 3D, Lanes, Score, Graph, Candidates, Events, A/B diff |
| 126 ★ | LB | `components/LayoutBrowser/LayoutRow.tsx` rename/duplicate/share/export/delete/overwrite("Save changes")/revert | Named layouts with dirty state, save and revert | -> layouts menu: "Review", "Strategy", "A/B" presets; modified marker, Save, Revert |
| 127 | LB | i18n `appBar.ts` importLayoutFromFile / exportLayoutToFile | Layout JSON import/export | -> share layouts with the team as JSON |
| 128 | LB | `LayoutBrowser/LayoutRow.tsx` favorite toggle | Star layouts | -> skip: few layouts expected |
| 129 | LB | `Workspace.tsx:keyDownHandlers` `[` / `]` | Toggle the left and right sidebars | -> `[` and `]` toggle the left sidebar (candidates) and right sidebar (inspector) |
| 130 | LB | `components/Sidebars/NewSidebar.tsx`, i18n `workspace.ts` Events/Panel/Performance/Alerts/Logs/Topics/Variables | Tabbed sidebars | -> right sidebar tabs: Inspector, Panel settings, Events, Alerts |
| 131 ★ | PV | `pqTabbedMultiViewWidget.cxx` Add/Remove View Tab, Rename Layout…, Close layout, "Pop out layout in separate window" | Layouts as tabs; pop a tab out | -> layout tabs at the top; pop out to a second monitor |
| 132 | PV | `pqTabbedMultiViewWidget.cxx`/`pqEqualizeLayoutReaction.h` "Equalize Views" Horizontally/Vertically/Both | Equalize split sizes | -> "Equalize panes" in the View menu |
| 133 | PV | `pqViewFrame.cxx` Maximize/Restore/Close | Per-view frame buttons | -> double-click a panel header to maximize or restore |
| 134 | PV | `pqLockPanelsReaction.h` | Lock docks against accidental drag | -> "Lock layout" toggle |
| 135 | PV | `pqPersistentMainWindowStateBehavior.h`, `pqLoadRestoreWindowLayoutReaction.h` | Persist window and dock state; save/load layout file | -> persist the layout in localStorage, with "Reset layout" |
| 136 | OBS | `OBSBasic.ui` `menuDocks`: resetDocks, lockDocks, sideDocks; `OBSBasic_Docks.cpp` ResetUIWarning | Docks menu with a confirm on reset | -> View ▸ Docks: Reset (with confirm), Lock |
| 137 | OBS | `OBSBasic.ui` toggleListboxToolbars / toggleStatusBar / toggleContextBar / toggleSourceIcons | Show or hide chrome pieces | -> View menu toggles: Status bar, Panel toolbars, Lane icons |
| 138 | OBS | `OBSBasic.ui` actionFullscreenInterface, actionAlwaysOnTop | Fullscreen UI | -> F11 fullscreen app; skip always-on-top (browser) |
| 139 | KD | `kdenliveui.rc` View: load_layouts, save_layout, manage_layout, show_titlebars | Layout menu plus title-bar toggle | -> "Hide panel titlebars" for a dense presentation mode |
| 140 | KD | `src/kddocksetup.cpp` | KDDockWidgets docking | -> reference only (use a React mosaic/dockview equivalent) |
| 141 | RV | `visualization_frame.cpp` "Hide Left Dock"/"Hide Right Dock", "&Panels" menu, "Add &New Panel", "&Delete Panel" | Panels menu | -> Panels menu listing every panel with a checkbox |

## 9. Panel settings

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 142 ★ | LB | `components/PanelSettings/index.tsx`, i18n `panelSettings.ts` "{{title}} panel settings", "Select a panel to edit its settings." | Settings sidebar bound to the focused panel | -> right sidebar "Panel settings" follows panel focus |
| 143 | LB | `PanelSettings/ActionMenu.tsx` Import/export settings…, Reset to defaults | Per-panel settings menu | -> ⋯ in settings: Reset to defaults, Copy/Paste settings JSON |
| 144 ★ | LB | i18n `settingsEditor.ts` "Search panel settings…", Filter list by visibility (List all/visible/invisible) | Searchable, filterable settings tree | -> search box at the top of the settings tree |
| 145 ★ | LB | i18n `threeDee.ts` Topics, Show all/Hide all, per-topic color/colorMode | Layer tree with eye toggles | -> 3D layers tree: Robots ▸ (R-T, R-B, B-T, B-B), Trails, Field zones, Game objects, Ghost (B) |
| 146 | LB | i18n `threeDee.ts` colorBy / colorMode Flat / Color map, min/max color | Color-by property | -> color robots by Team / Role / State / Speed |
| 147 | LB | i18n `plot.ts` series: Add/Delete/Move up/down/Reorder, Show lines/values/labels, Legend position Floating/Top/Left | Series editor plus legend placement | -> score chart series: Red total, Blue total, per-robot contribution; legend position |
| 148 | LB | i18n `plot.ts` xAxis/yAxis min/max with validation ("Y max must be greater than Y min") | Axis bounds with inline validation | -> score chart Y bounds plus inline error |
| 149 | LB | i18n `plot.ts` timestamp Receive Time / Header Stamp | Time source choice | skip: one clock |
| 150 | PV | `pqAutoApplyReaction.h` "Apply changes to parameters automatically" | Auto-apply vs explicit Apply | -> candidate parameter editor: Auto-recompute toggle vs Apply button (sim may be slow) |
| 151 | PV | `pqPropertyPanelVisibilitiesBehavior.h` | Default vs advanced properties (gear) | -> gear icon to show advanced settings |
| 152 | PV | `pqColorPaletteSelectorWidget.h`, `pqLoadPaletteReaction.h` | Color palette presets | -> palette preset: default / colorblind-safe / print |
| 153 | RV | `displays_panel.cpp` Add (Ctrl+N), Duplicate (Ctrl+D), Remove (Ctrl+X), Rename (Ctrl+R) | Display list CRUD with shortcuts | -> candidates list: New, Duplicate, Delete, Rename with the same keys |
| 154 | RV | `tool_properties_panel.cpp` | Settings of the active tool | -> measure-tool settings (units) |

## 10. Context menus

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 155 ★ | OBS | `OBSBasic_SceneItems.cpp:CreateSourcePopupMenu` (Properties, Filters, Interact, Projector.Open.Source, Screenshot.Source, order Move Up/Down/Top/Bottom, Group, Hide in mixer) | Rich per-item menu | -> robot context menu (3D and lane header): Follow, Solo, Hide, Show trail, Inspect, Screenshot this robot, Copy state at t |
| 156 | OBS | `OBSBasic_Preview.cpp:on_preview_customContextMenuRequested` | Preview right-click reuses the source menu | -> right-click in 3D on empty space: camera presets, overlay toggles, background |
| 157 | OBS | `OBSBasic.ui` transformMenu (Fit/Center/Reset) | Transform submenu | -> skip: robots are not user-transformable |
| 158 | KD | `monitor.cpp` m_contextMenu "Set current image as thumbnail" | Monitor menu | -> "Set as thumbnail for this candidate" |
| 159 | KD | `kdenliveui.rc` Current Clip / Current Item submenus | Context-sensitive submenus | -> lane event context menu: Jump to start, Select range, Add marker, Show in graph, Copy |
| 160 | KD | `kdenliveui.rc` `clip_in_timeline` list of occurrences | List every place an item is used | -> graph node context menu: "Occurrences in path A / B" (jump list) |
| 161 | PV | `pqPipelineContextMenuBehavior.h` | Right-click on an object in the 3D view for visibility/color actions | -> same as #155 (Hide, Color by, Isolate) |
| 162 | PV | `pqShowHideAllReaction.h` | Show all / hide all | -> lane and 3D context menus: "Show all robots" |
| 163 | KD | `Ruler.qml` showRulerMenu | Ruler context menu | -> see #29 |
| 164 | LB | `LayoutBrowser/LayoutRow.tsx` menu items | Layout row menu | -> see #126 |

## 11. Status bar

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 165 ★ | OBS | `forms/StatusBarWidget.ui` message, delayInfo, droppedFrames, kbps, streamTime, recordTime, cpuUsage, fpsCurrent | Segmented status bar with fixed-width framed cells | -> cells: message, active path name, sim step/t, render FPS, sim compute time, dirty-state indicator |
| 166 | OBS | `widgets/OBSBasicStatusBar.cpp` (icons change by state) | State icons (red/yellow/green) | -> computation status icon: idle / computing candidates / error |
| 167 | OBS | `OBSBasic.ui` `stats` action (Basic.Stats) | Detailed stats dialog | -> click the FPS cell to open a perf popover |
| 168 | LB | `AppBar/NetworkStatusIndicator.tsx` Online/Offline | Connectivity badge | -> offline badge if the app loads remote logs |
| 169 | LB | i18n `appSettings.ts` memoryUseIndicator | Memory use meter | -> skip unless graph exploration becomes heavy |
| 170 | LB | `AppBar/EndTimestamp.tsx`, `DataSource.tsx` | Data source name plus end time in the app bar | -> app bar: match file name + "180.0 s" + phase |
| 171 | KD | `pCore->displayMessage(..., InformationMessage)` (monitor.cpp:2746) | Typed transient status messages | -> status message types info/warn/error with auto-fade |
| 172 | RV | `visualization_frame.cpp` setStatus, fps, "Reset" | Status text plus a global Reset button | -> "Reset view state" in the status bar |
| 173 | PV | `pqTimerLogReaction.h`, `pqLogViewerReaction.h` | Timer log and log viewer | -> Help ▸ Show log (sim warnings) |

## 12. Preferences / app menus

| # | Tool | Source | Function | Mapping |
|---|---|---|---|---|
| 174 ★ | LB | `AppSettingsDialog/AppSettingsDialog.tsx` + i18n `appSettings.ts` General/Advanced/Extensions; Color scheme Dark/Light/Follow system; Language; Timestamp format; Step size; Message rate | Compact settings dialog | -> Prefs: Theme, Language (JA/EN), Time format, Seek step size, Default playback speed |
| 175 | LB | i18n `appSettings.ts` experimentalFeatures, debugModeDescription | Feature flags | -> "Experimental" tab for unstable panels |
| 176 ★ | PV | `pqCustomizeShortcutsDialog.ui` search, QKeySequenceEdit, Record, Clear, Reset, Reset All | Shortcut editor | -> shortcut editor with search and reset; store in localStorage |
| 177 | PV | `pqResetDefaultSettingsReaction.h` | Reset all settings | -> Prefs ▸ Reset all (with confirm) |
| 178 | PV | `pqAutoSaveBehavior.h`, `pqCrashRecoveryBehavior.h` | Background state autosave and crash recovery | -> autosave session (markers, candidates, layout); "Restore previous session?" on load |
| 179 | PV | `pqUndoRedoBehavior.h`, `pqMainControlsToolbar.ui` Undo/Redo, Save/Load State | Global undo plus state files | -> undo/redo for markers and candidate edits; Save/Load session JSON |
| 180 | KD | `kdenliveui.rc` File: open_recent, revert, save_copy, archive_project, open_backup | Project file ops | -> File: Open match log, Recent, Revert, Save session copy |
| 181 | KD | `kdenliveui.rc` Edit: clear_undo_history, project_find/find_next | Undo history and find | -> Edit: Find (Ctrl+F), Find next (F3) |
| 182 | KD | `kdenliveui.rc` settings: themes_menu, styles_menu, reset_config, run_wizard | Theme and reset | -> covered by #174 and #177 |
| 183 | OBS | `OBSBasic.ui` profileMenu / sceneCollectionMenu (New, Duplicate, Rename, Remove, Import, Export) | Two kinds of named collections | -> "Candidate sets" menu with the same CRUD and import/export verbs |
| 184 | OBS | `OBSBasic.ui` actionShowSettingsFolder, help: logs/crash logs/upload | Support menu | -> Help: Copy debug info (KD `copy_debuginfo`) |
| 185 | RV | `visualization_frame.cpp` "&Recent Configs", "Save Config &As" | Config files | -> same as #180 |
| 186 | LB | `AppBar/AppMenu.tsx` File ▸ Open…, Open local file(s)…, Recent data sources; View ▸ show/hide sidebars; Help ▸ Documentation/About | Compact hamburger app menu | -> single app menu (web): File / View / Help |

## 13. Keyboard conventions (default bindings found in source)

| # | Tool | Source | Binding | Mapping |
|---|---|---|---|---|
| 187 ★ | KD | `monitor/monitormanager.cpp` monitor_play | Space = play/pause | -> Space |
| 188 ★ | KD | `monitormanager.cpp` monitor_seek_backward/pause/forward | J / K / L shuttle (J and L repeated step through speedArray) | -> J/K/L; L repeated = 2x, 4x, 8x |
| 189 | KD | `kdenliveui.rc` monitor_play_zone / monitor_loop_zone | Ctrl+Space play zone; Ctrl+Shift+Space loop zone | -> same |
| 190 ★ | KD | `monitormanager.cpp` seek frame/second | ←/→ one frame; Shift+←/→ one second | -> ←/→ 1 tick, Shift 1 s |
| 191 | KD | `mainwindow_actions.cpp` | Alt+←/→ prev/next snap point; Ctrl+←/→ prev/next guide | -> Alt+←/→ prev/next event on the active lane; Ctrl+←/→ prev/next marker |
| 192 | KD | `monitormanager.cpp` seek_start/seek_end | Home / End | -> same |
| 193 | KD | `kdenliveui.rc` mark_in/mark_out; seek_zone_start/end | I / O set range; Shift+I/O go to range | -> same |
| 194 | KD | `mainwindow_actions.cpp` add_sequence_marker | G add/remove marker | -> M (or G for Kdenlive muscle memory) |
| 195 | KD | `mainwindow_actions.cpp` focus_timecode `=`; align_playhead P; switch_monitor T; monitor_multitrack F12 | Misc | -> `=` time field, P playhead to mouse, T switch A/B focus, F12 2x2 multi-cam |
| 196 | KD | `mainwindow_actions.cpp` Shift+H / Ctrl+Shift+H, Shift+L / Ctrl+Shift+L | Toggle track disabled/lock (current, all) | -> Shift+H hide current robot lane; Shift+S solo |
| 197 | LB | `PlaybackControls/index.tsx` keyHandlers | Space, ArrowLeft/Right (Shift fine, Alt coarse) | -> consistent with #190 |
| 198 | LB | `Workspace.tsx:keyDownHandlers` | `[` / `]` sidebars; Ctrl+O open, Ctrl+Shift+O connection | -> same |
| 199 | RV | `views_panel.cpp` Zero | Z = reset view | -> Z = reset camera (only when the 3D view has focus) |
| 200 | RV | `displays_panel.cpp` | Ctrl+N/D/X/R new/duplicate/remove/rename | -> candidates list |
| 201 | RV | `visualization_frame.cpp` | F11 fullscreen; Ctrl+Q quit | -> F11 only |
| 202 | PV | `pqCustomizeShortcutsDialog.ui` | Every shortcut can be rebound | -> see #176 |
| 203 | PV | `pqSearchItemReaction.h` | Type-to-filter in item widgets | -> typing in any list (candidates, events) filters it |
| 204 | LB | `Plot.tsx` createMeasureModeEscapeHandler | Esc exits measure mode | -> Esc exits any modal tool (measure, waypoint, rubber-band) |

---

### Top picks for the redesign
1. A/B = OBS Studio Mode (#98-#103) + Kdenlive split-wipe (#106) + LB syncCamera (#78) + RViz SyncMode (#109). Labels over each pane show the score delta.
2. Transport = LB bar (#1-#9: speed menu, loop, TOD/SEC toggle, event ticks, buffered ranges) + PV Reverse (#13) + KD J/K/L (#188).
3. Ruler and zones = KD Ruler/RulerZone (#26-#30, #40-#50): adaptive ticks, Ctrl+wheel zoom, range markers with categories, I/O range.
4. Lane headers = KD TrackHead eye/lock/solo/collapse with Shift-for-team (#55-#60).
5. Linking and selection = PV link manager plus Find Data plus "Selected only" table (#111-#117); LB "Selected object" inspector (#120).
6. Layout = LB mosaic ⋯ menu plus layout browser with save/revert (#124-#126); PV tabs, pop-out, and equalize (#131-#132).
7. Status bar = OBS StatusBarWidget segmented cells (#165).
