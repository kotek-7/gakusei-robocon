# Peripheral UI reference: Blender + Godot → robocon match-analysis tool

Source: shallow sparse clones (2026-10-14) in `scratchpad/oss/blender` (`scripts/startup/bl_ui`, `scripts/presets/keyconfig/keymap_data`, `source/blender/editors/space_view3d`) and `scratchpad/oss/godot/editor`.
Abbrev: **B** = Blender (paths relative to `scripts/startup/bl_ui/` unless noted), **G** = Godot (paths relative to `editor/`). "Ours" = suggested mapping for the app: 3D field replay (robots TR/BR × red/blue, blocks, towers on 10 building spots), match time 0–180 s, state graph (nodes/edges), candidate strategy tables, evaluations, condition editor.

Items are numbered for cross-reference (#1 to #314).

---

## 1. Menubar (top bar)

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 1 | B | space_topbar.py : TOPBAR_MT_editor_menus | Top menus: app-logo, File, Edit, Render, Window, Help | Menubar: **File, Edit, View, Match, Analysis, Window, Help** |
| 2 | B | TOPBAR_MT_blender | Logo menu: Splash, About, Install App Template, System | App logo menu: About, version/build hash, "What's new" |
| 3 | B | TOPBAR_MT_blender_system | Reload Scripts, Memory Statistics, Debug Menu | Help > Developer: reload rule set, memory stats, debug overlay |
| 4 | B | TOPBAR_MT_file : New (TOPBAR_MT_file_new) | New file from templates (General, 2D Anim, …) | File > New Analysis ▸ templates: Blank / From match log / From recorded video |
| 5 | B | TOPBAR_MT_file : wm.open_mainfile | Open… | File > Open match log (JSON/CSV) |
| 6 | B | TOPBAR_MT_file_open_recent | Recent files submenu + clear | File > Open Recent ▸ last 10 matches (localStorage) + "Clear Recent" |
| 7 | B | TOPBAR_MT_file : wm.revert_mainfile | Revert to saved | File > Revert analysis to last save |
| 8 | B | TOPBAR_MT_file_recover | Recover Last Session / Auto Save… | File > Recover ▸ Last Session / Autosaves… |
| 9 | B | TOPBAR_MT_file : save / save_as / Save Copy / Save Incremental | Four save variants | Save, Save As, Save Copy, **Save Incremental** (`analysis_v003.json`) |
| 10 | B | TOPBAR_MT_file : wm.link / wm.append | Pull datablocks from another file | File > Append candidates/conditions from another analysis |
| 11 | B | TOPBAR_MT_file_import / _export | Import / Export by format | Import: match log, video timestamps; Export: CSV of evaluations, PNG of graph, glTF of field |
| 12 | B | TOPBAR_MT_file_external_data | Pack/unpack, make paths relative, report missing files | skip: no external assets beyond the log; maybe "Report missing video file" |
| 13 | B | TOPBAR_MT_file_cleanup : orphans_purge | Purge unused data | Analysis > Clean Up ▸ Purge unused conditions / orphan candidates |
| 14 | B | TOPBAR_MT_file_defaults | Save Startup File / Load Factory Settings | File > Defaults ▸ Save current layout as startup / Load factory layout |
| 15 | B | TOPBAR_MT_file : wm.quit_blender | Quit | skip: browser tab |
| 16 | B | TOPBAR_MT_edit : ed.undo / ed.redo / Undo History | Undo, redo, history list | Edit > Undo/Redo + **Undo History** submenu (condition edits, candidate edits) |
| 17 | B | TOPBAR_MT_edit : screen.redo_last | "Adjust Last Operation…" panel | Re-open params of last op (e.g. last "Generate candidates" with N/threshold) |
| 18 | B | TOPBAR_MT_edit : screen.repeat_last / repeat_history | Repeat last / pick from history | Shift+R repeat last action (e.g. apply same filter to next robot) |
| 19 | B | TOPBAR_MT_edit : wm.search_menu (F3) | Menu Search | **Command palette** (F3 / Ctrl+K) searching all menu items |
| 20 | B | TOPBAR_MT_edit : wm.search_operator | Operator search (dev) | Palette "> " prefix to search raw actions |
| 21 | B | TOPBAR_MT_edit : "Rename Active Item…" (F2) | Popup rename of active thing | F2 rename active node/candidate/marker |
| 22 | B | TOPBAR_MT_edit : wm.batch_rename | Batch rename | skip (low value) / maybe batch-rename candidates by pattern |
| 23 | B | TOPBAR_MT_edit : lock_object_mode | Lock object interaction mode | skip |
| 24 | B | TOPBAR_MT_edit : screen.userpref_show | Preferences… | Edit > Preferences… (Ctrl+,) |
| 25 | B | TOPBAR_MT_render : Render Image / Animation / View Render | Produce output | "Match" menu: Render clip (export video of 3D replay range), Snapshot frame |
| 26 | B | TOPBAR_MT_render : use_lock_interface | Lock UI while rendering | Option: lock UI during long evaluation batch |
| 27 | B | TOPBAR_MT_window : wm.window_new / window_new_main | New window | Window > New Window (pop out graph to 2nd monitor via window.open) |
| 28 | B | TOPBAR_MT_window : window_fullscreen_toggle | Fullscreen | Window > Toggle Fullscreen (F11 / Fullscreen API) |
| 29 | B | TOPBAR_MT_window : workspace_cycle Next/Prev | Cycle workspaces | Ctrl+PgUp/PgDn cycle workspaces |
| 30 | B | TOPBAR_MT_window : show_statusbar | Toggle status bar | Window > Show Status Bar |
| 31 | B | TOPBAR_MT_window : screen.screenshot / screenshot_area | Save screenshot (whole / editor) | Window > Screenshot ▸ whole app / active panel (for reports) |
| 32 | B | TOPBAR_MT_window : wm.console_toggle | System console | Window > Toggle Log Console |
| 33 | B | TOPBAR_MT_help : Manual, Release Notes, Report a Bug, wm.sysinfo | Help links + system info | Help > Manual, Rule book PDF, Shortcuts cheat sheet, Report bug (prefills version) |
| 34 | B | TOPBAR_MT_help : wm.operator_cheat_sheet | Dumps all operators | Help > Keyboard shortcut sheet (generated from keymap) |
| 35 | B | TOPBAR_MT_file_context_menu | Right-click on empty topbar = condensed File menu | Right-click menubar = quick file actions |
| 36 | G | editor_node.cpp : `_add_to_main_menu` | Menus: Scene, Project, Debug, Editor, Help | confirms 5–7 top menus is enough |
| 37 | G | editor_node.cpp : editor/quick_open_scene, quick_open_script | Quick Open dialogs (fuzzy) | Ctrl+P quick-open match / candidate by name |
| 38 | G | editor_node.cpp : editor/reopen_closed_scene | Reopen last closed tab | Ctrl+Shift+T reopen closed match tab |
| 39 | G | editor_node.cpp : editor/save_all_scenes | Save All | Save all open analyses |
| 40 | G | editor_node.cpp : editor/reload_saved_scene | Reload from disk | "Reload log from source" (re-fetch match log) |
| 41 | G | editor_node.cpp : editor/close_scene / close_all_scenes | Close / close all scene tabs | Close match / Close all |
| 42 | G | editor_node.cpp : editor/next_tab / prev_tab | Cycle scene tabs | Ctrl+Tab cycle open matches |
| 43 | G | editor_node.cpp : editor/find_in_files | Find in Files | Analysis > Find in all matches (search events, e.g. "tower 7 captured") |
| 44 | G | editor_node.cpp : editor/orphan_resource_explorer | Lists unused resources | Same as #13 as a dialog |
| 45 | G | editor_node.cpp : editor/command_palette | Command palette | as #19 |
| 46 | G | editor_node.cpp : editor/take_screenshot (tooltip says where saved) | Screenshot | as #31 |
| 47 | G | editor_node.cpp : Project > Version Control / Pack as ZIP / Open User Data Folder | Project-level utilities | File > Export bundle (.zip of log+analysis) |
| 48 | G | editor_node.cpp : settings_menu "Editor Docks", "Editor Layout" | Docks toggles + layout presets submenu | Window > Panels ▸ (toggle each panel), Window > Layout ▸ presets |
| 49 | G | editor_node.cpp : layout/save, layout/delete, layout/default | Save/Delete/Default layout | Window > Layout ▸ Save Layout…, Delete Layout…, Default |
| 50 | G | editor_node.cpp : Manage Editor Features… (feature profiles) | Hide whole features per profile | "Beginner/Pro" UI profile hiding advanced panels |
| 51 | G | editor_node.cpp : Help > Copy System Info, Suggest a Feature, Send Docs Feedback | Feedback items | Help > Copy debug info (build, browser, log hash) |
| 52 | G | run/editor_run_bar.cpp : Run Project / Pause / Stop / Run Current Scene | Run bar at top-right | Top-right **replay transport mini-bar** (Play/Pause/Stop) always visible |
| 53 | G | run/editor_run_bar.cpp : editor/next_frame_embedded_project | Step one frame while paused | "Next tick" button |
| 54 | G | debugger : Debug menu checkboxes (Visible Collision Shapes, Visible Paths, Visible Navigation) | Debug visualization toggles in a menu | View > Debug ▸ robot hitboxes, planned paths, reachable areas |
| 55 | G | editor_node.cpp : editor/distraction_free_mode | Hide all docks | Ctrl+Shift+F11 distraction-free (viewport only) |
| 56 | G | interface/editor/collapse_main_menu (setting) | Collapse menubar into one ☰ button | Narrow screens: collapse menubar into hamburger |

## 2. Editor headers & toolbars

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 57 | B | space_view3d.py : VIEW3D_HT_header → template_header() | Editor-type dropdown at left of every header | Each panel header starts with a panel-type switcher (Viewport/Graph/Table/Timeline) |
| 58 | B | VIEW3D_HT_header : mode dropdown (operator_menu_enum object.mode_set) | Interaction mode selector | Mode: **Replay / Annotate / Edit Conditions** |
| 59 | B | VIEW3D_MT_editor_menus.draw_collapsible | Header menus collapse into one icon when narrow | Collapse header menus to ☰ at small widths |
| 60 | B | VIEW3D_HT_header : transform orientation / pivot (prop_with_popover) | Compact dropdown + popover pair | skip transform; reuse pattern for "Camera follow target" dropdown |
| 61 | B | VIEW3D_HT_header : use_snap toggle + snapping popover | Toggle + ▾ popover idiom | Pattern: [toggle][▾] for every option group (e.g. trails on + trail settings) |
| 62 | B | VIEW3D_HT_header : proportional edit toggle + falloff popover | same idiom | skip feature |
| 63 | B | VIEW3D_HT_header : object-type visibility popover (VIEW3D_PT_object_type_visibility) | Per-type visible/selectable eye/arrow grid | Popover: Robots / Blocks / Towers / Spots / Field markings, each visible+selectable |
| 64 | B | VIEW3D_HT_header : show_gizmo toggle + VIEW3D_PT_gizmo_display popover | Gizmo master toggle | Toggle nav gizmo, measurement gizmo, heading arrows |
| 65 | B | VIEW3D_HT_header : show_overlays toggle + VIEW3D_PT_overlay popover | Overlays master toggle | Master overlay toggle (Alt+Shift+Z) + popover (see §3) |
| 66 | B | VIEW3D_HT_header : _toggle_xray_operator | X-ray (see-through) toggle | X-ray towers/blocks so robots behind are visible |
| 67 | B | VIEW3D_HT_header : shading type expand (Wire/Solid/Material/Rendered) | 4 segmented shading buttons | Segmented: Schematic(top-down 2D) / Solid / Textured |
| 68 | B | VIEW3D_PT_shading_color : color_type | Color by material/object/attribute/random/single | **Color robots by**: alliance / role (TR/BR) / state / speed / single |
| 69 | B | VIEW3D_PT_shading_color : background_type | Theme / world / custom bg | Background: theme / field photo / custom color |
| 70 | B | VIEW3D_PT_shading_lighting : light Studio/MatCap/Flat | Lighting mode | Flat (default for analysis) vs Studio |
| 71 | B | VIEW3D_PT_shading_options (shadow, cavity, outline, specular) | Shading extras | Shadows toggle, outline toggle |
| 72 | B | DOPESHEET_HT_editor_buttons : filters (only selected, show hidden, only errors) | Filter toggles in header | Timeline header: Only selected robot, Show hidden tracks, Only errors/fouls |
| 73 | B | DOPESHEET_HT_header : search field + use_multi_word_filter | Channel search | Timeline/table search with multi-word match |
| 74 | B | OUTLINER_HT_header : display_mode dropdown | View Layer/Scenes/Blender File/Data API/Orphan | Scene-tree display mode: Field Objects / Events / Candidates / Orphans |
| 75 | B | OUTLINER_HT_header : filter_text + use_sync_select | Search + sync selection toggle | Search + "Sync selection with viewport/graph" toggle |
| 76 | B | OUTLINER_HT_header : filter popover OUTLINER_PT_filter | Filter options popover | as §7 |
| 77 | B | OUTLINER_HT_header : collection_new | New collection button | "+ Group" for custom robot/object groups |
| 78 | B | PROPERTIES_HT_header : search_filter + PROPERTIES_PT_options | Search properties + options | Inspector header: property search + options (sync with outliner) |
| 79 | B | space_properties.py : PROPERTIES_PT_navigation_bar | Vertical icon tab strip (Tool, Render, Output, Scene, Object…) | Inspector vertical tabs: Match, Robot, Object, Node, Candidate, Evaluation |
| 80 | G | node_3d_editor_plugin.cpp : spatial_editor/tool_select/move/rotate/scale | Tool-mode button row (Q/W/E/R) | Tool row: Select (Q), Measure (M), Annotate (A), Pan (H) |
| 81 | G | node_3d_editor_plugin.cpp : spatial_editor/measure "Ruler Mode" | LMB-drag measures distance | **Ruler**: distance robot→tower in mm |
| 82 | G | node_3d_editor_plugin.cpp : spatial_editor/local_coords, snap toggles | Toolbar toggle buttons | skip local; "Snap measurement to objects" toggle |
| 83 | G | node_3d_editor_plugin.cpp : spatial_editor/configure_snap | Snap config dialog | skip |
| 84 | G | node_3d_editor_plugin.cpp : list-select tooltip "Show list of selectable nodes at position clicked" | Alt+RMB pick list | Click on overlapping robots → popup list to pick one |
| 85 | G | node_3d_editor_plugin.cpp : Lock / Unlock / Group / Ungroup selected | Toolbar buttons locking selection | Lock a robot from being selected/moved during annotation |
| 86 | G | node_3d_editor_plugin.cpp : preview sun / preview environment toggles | Toggle editor-only lights | skip (or "field lighting preset") |
| 87 | G | node_3d_editor_plugin.cpp : spatial_editor/1_viewport … 4_viewports (+Alt) | Viewport layout menu, 1–4 panes | View > Viewports ▸ 1 / 2 / 2-alt / 3 / 4 (e.g. top + follow-cam per robot) |
| 88 | G | canvas_item_editor_plugin.cpp : show_rulers, show_guides, show_origin, show_helpers | 2D view menu toggles | State-graph view: show grid, rulers, origin |
| 89 | G | canvas_item_editor_plugin.cpp : snap toggles (smart snap, grid snap) | 2D snapping | Graph layout: snap nodes to grid |
| 90 | G | gui/editor_zoom_widget.cpp : Zoom Out / Reset Zoom (%) / Zoom In | `[-] 100% [+]` widget in 2D view corner | Same widget in state-graph corner |
| 91 | G | canvas_item_editor_plugin.cpp : zoom_25…1600_percent shortcuts | Fixed zoom presets | Graph: 1–5 keys zoom presets; 0 = fit |

## 3. Viewport overlays, gizmos, view menu (edge widgets)

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 92 | B | source/.../space_view3d/view3d_gizmo_navigate.cc : GZ_INDEX_ROTATE (+ prefs mini_axis_type) | Axis-ball gizmo top-right; click axis = snap view | Top-right axis ball: click X/Y/Z = side/end/top views of field |
| 93 | B | view3d_gizmo_navigate.cc : GZ_INDEX_MOVE / ZOOM | Drag-buttons for pan & zoom under the gizmo | Hand + magnifier drag buttons under gizmo (touch/laptop friendly) |
| 94 | B | view3d_gizmo_navigate.cc : GZ_INDEX_PERSP / ORTHO | Toggle persp/ortho button | Persp/Ortho toggle button |
| 95 | B | view3d_gizmo_navigate.cc : GZ_INDEX_CAMERA_ON/OFF, CAMERA_LOCK | Toggle camera view, lock camera to view | "Broadcast cam" toggle + lock |
| 96 | B | VIEW3D_PT_overlay_text : show_text, show_stats, show_performance | Text overlay (view name, stats, fps) top-left | Top-left text: view name, `t=73.4 s`, selected robot, FPS |
| 97 | B | VIEW3D_PT_overlay_guides : show_floor, show_ortho_grid, grid_scale, subdivisions | Floor/grid overlay | Field grid (1 m / 250 mm subdiv) toggle + scale |
| 98 | B | VIEW3D_PT_overlay_guides : show_axis_x/y/z | Axis lines | Field centre lines toggle |
| 99 | B | VIEW3D_PT_overlay_guides : show_cursor | 3D cursor | "Probe point" cursor for measurement |
| 100 | B | VIEW3D_PT_overlay_guides : show_annotation | Annotation strokes visibility | Coach drawings on field on/off |
| 101 | B | VIEW3D_PT_overlay_object : show_extras | Non-geometry helpers | Spot IDs (1–10), zone boundaries |
| 102 | B | VIEW3D_PT_overlay_object : show_relationship_lines | Lines parent→child | Line robot → its target tower / carried block |
| 103 | B | VIEW3D_PT_overlay_object : show_outline_selected | Selection outline | Selection outline on robot |
| 104 | B | VIEW3D_PT_overlay_object : show_motion_paths | Motion path overlay | **Robot trails** (past N s / full match), color by time |
| 105 | B | VIEW3D_PT_overlay_object : show_object_origins(_all) | Origin dots | Robot centre/heading dot |
| 106 | B | VIEW3D_PT_overlay_geometry : wireframe_opacity, show_fade_inactive | Fade inactive geometry | **Fade non-selected robots** (alpha slider) |
| 107 | B | VIEW3D_PT_overlay_viewer_node : show_viewer_text | Attribute text in viewport | Per-tower owner label / block count labels |
| 108 | B | VIEW3D_PT_gizmo_display : show_gizmo_navigate/tool/context | Per-gizmo-class toggles | Toggle nav gizmo / ruler / heading arrows separately |
| 109 | B | VIEW3D_MT_view : show_region_toolbar/ui/hud/asset_shelf | Toggle T-panel, N-panel, HUD | View > Toolbar (T), Sidebar (N), Last-op HUD |
| 110 | B | VIEW3D_MT_view : view_selected (Numpad .) / view_all (Home) | Frame selected / all | `.` frame selected robot, Home frame whole field |
| 111 | B | VIEW3D_MT_view : view_persportho | Persp/ortho | Numpad 5 |
| 112 | B | VIEW3D_MT_view_local : localview (/) | Isolate selection | `/` isolate selected robot (hide others) |
| 113 | B | VIEW3D_MT_view_cameras : object_as_camera, view_camera | Cameras menu | View > Cameras ▸ Broadcast, Driver-station red, Driver-station blue, Follow TR-red… |
| 114 | B | VIEW3D_MT_view_viewpoint : Top/Bottom/Front/Back/Right/Left | Axis viewpoints | Top / Red side / Blue side / Left / Right |
| 115 | B | VIEW3D_MT_view_navigation : orbit, roll, pan, zoom in/out, Zoom Region, fly, walk | Navigation menu | View > Navigation ▸ orbit 15°, zoom in/out, zoom region (box), fly |
| 116 | B | VIEW3D_MT_view_align : view_lock_to_active / view_lock_clear | Lock view to object | **Follow selected robot** camera + clear |
| 117 | B | VIEW3D_MT_view_regions : clip_border | Clipping region | skip / maybe "clip to half field" |
| 118 | B | VIEW3D_MT_view : screen.animation_play "Play Animation" | Play from view menu | View > Play (Space) |
| 119 | B | VIEW3D_MT_view : Viewport Render Image/Animation | Capture viewport | Export viewport frame / clip |
| 120 | B | VIEW3D_PT_quad_view : lock_rotation, show_sync_view, use_box_clip | Quad view sync | 4-view: sync zoom/pan between ortho panes |
| 121 | B | VIEW3D_PT_view3d_properties : lens, clip_start/end | View camera params | Sidebar View tab: FOV slider |
| 122 | B | VIEW3D_PT_view3d_lock : lock_object, lock_camera, lock_rotation | Lock view | Sidebar: Follow object dropdown, lock rotation (top-down only) |
| 123 | B | VIEW3D_PT_view3d_cursor : location | Numeric cursor position | Probe point XY numeric input |
| 124 | B | VIEW3D_PT_collections | Collection visibility list in sidebar | Sidebar list of groups (Red alliance, Blue alliance, Blocks, Towers) with eye toggles |
| 125 | G | scene/3d/node_3d_editor_viewport.h : ViewportRotationControl | Clickable axis gizmo (setting show_viewport_rotation_gizmo) | as #92 |
| 126 | G | node_3d_editor_viewport.h : ViewportNavigationControl | On-screen joystick pads for move/look (touch) (show_viewport_navigation_gizmo) | Optional touch pads on tablets |
| 127 | G | node_3d_editor_viewport.cpp : "Perspective"/"Orthogonal"/"Auto Orthogonal Enabled" | Per-viewport top-left view menu | Each viewport pane has its own top-left view menu |
| 128 | G | node_3d_editor_viewport.cpp : "Lock View Rotation" | Prevent orbit | Lock to top-down 2D |
| 129 | G | node_3d_editor_viewport.cpp : Display Normal/Wireframe/Overdraw/Lighting/Unshaded | Debug draw modes | as #67 |
| 130 | G | node_3d_editor_viewport.cpp : View Environment / Gizmos / Transform Gizmo / Grid | Visibility checkboxes in view menu | same checkboxes |
| 131 | G | node_3d_editor_viewport.cpp : "View Information" | Shows info text overlay | as #96 |
| 132 | G | node_3d_editor_viewport.cpp : "View Frame Time" | FPS/frame ms overlay | Perf overlay (dev) |
| 133 | G | node_3d_editor_viewport.cpp : "Half Resolution" | Render at half res | Low-power mode for laptops |
| 134 | G | node_3d_editor_viewport.cpp : "Cinematic Preview" | Show only render-visible | "Presentation mode": hide all overlays |
| 135 | G | node_3d_editor_viewport.cpp : "Toggle Camera Preview", "Toggle Pilot Mode" | Look through camera / drive it | Look through follow-cam of a robot |
| 136 | G | node_3d_editor_plugin.cpp : spatial_editor/focus_selection, focus_origin, focus_aabb | Focus shortcuts | F = focus selected, Shift+F = field origin |
| 137 | G | node_3d_editor_plugin.cpp : orbit_view_left/right/up/down/180 | Keyboard orbit | Numpad 4/6/8/2, Ctrl+9 opposite |
| 138 | G | node_3d_editor_plugin.cpp : increase_fov / decrease_fov / reset_fov | FOV keys | Ctrl+wheel FOV, reset |
| 139 | G | node_3d_editor_plugin.cpp : freelook_toggle (Shift+F) | WASD fly mode | Fly-cam for broadcast shots |
| 140 | G | node_3d_editor_plugin.cpp : view_grid / view_origin | Grid / origin toggles | as #97 |
| 141 | G | settings : editors/3d/selection_box_color, active_selection_box_color | Active vs selected color | Distinct active (bright) vs selected (dim) robot outline |
| 142 | G | settings : editors/3d/grid_size, primary_grid_steps, grid_division_level_* | Adaptive grid | Adaptive grid subdivision on zoom |

## 4. Context (right-click) menus & pie menus

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 143 | B | VIEW3D_MT_object_context_menu | Object RMB: set active camera, adjust lens, transform, show/hide, delete | RMB robot: Follow cam, Isolate, Show trail, Add marker at this event, Copy pose (x,y,θ,t), Hide |
| 144 | B | VIEW3D_MT_object_context_menu (empty-space branch) : Add, Paste | RMB empty space: Add/Paste | RMB empty field: Add annotation, Add probe here, Paste |
| 145 | B | VIEW3D_MT_object_showhide : hide_view_clear / Hide Selected / Hide Unselected | H / Shift+H / Alt+H | Same three on robots/blocks |
| 146 | B | VIEW3D_MT_select_object : All / None / Invert / More/Less / Parent/Child | Select menu | Select all robots of alliance, invert, select "carrying block" |
| 147 | B | DOPESHEET_MT_context_menu : copy, paste, keyframe type, interpolation, snap, delete | Key RMB | Timeline event RMB: Copy time, Jump here, Set range start/end, Add marker, Tag event type |
| 148 | B | DOPESHEET_MT_channel_context_menu | Channel RMB | Track-header RMB: Hide, Solo, Lock, Color, Collapse |
| 149 | B | OUTLINER_MT_context_menu + _view (show_active, expanded_toggle, show_one_level) | Tree RMB | Tree RMB: Show active, Expand all, Show/Hide one level |
| 150 | B | OUTLINER_MT_collection_visibility | Isolate / show all / hide in collections | Groups RMB: Isolate group, Show all |
| 151 | B | INFO_MT_context_menu : report_copy / report_delete | Log RMB | Log panel RMB: Copy, Delete, Clear |
| 152 | B | INFO_MT_area (in every View menu & header RMB) | Area menu: split, maximize, duplicate, close | Every panel header RMB → Area menu (§10) |
| 153 | B | VIEW3D_MT_view_pie (`~`) | Pie: 6 axis views + camera + selected | Pie on `~`: Top / Red / Blue / L / R / Follow / Broadcast / Frame selected |
| 154 | B | VIEW3D_MT_shading_pie (Z) / shading_ex_pie | Pie: shading types, x-ray, overlays | Pie on Z: Schematic / Solid / Textured / X-ray / Overlays |
| 155 | B | VIEW3D_MT_snap_pie (Shift+S) | Cursor/selection snapping pie | Pie on Shift+S: probe-to-robot, probe-to-tower, probe-to-spot |
| 156 | B | VIEW3D_MT_pivot_pie / orientations_pie | Other pies | skip |
| 157 | B | DOPESHEET_MT_snap_pie : to current frame / nearest frame / second / marker | Snap pie | Timeline Shift+S: snap selection to cursor / nearest second / nearest marker |
| 158 | B | OUTLINER_MT_view_pie | Outliner pie | skip |
| 159 | B | DOPESHEET_MT_view_pie | Frame All/Selected/Current pie | Timeline `~` pie: frame all / selected range / current |
| 160 | G | docks/scene_tree_dock.cpp : Add Child, Rename, Duplicate, Move Up/Down, Copy Node Path, Cut/Copy/Paste as sibling/child | Scene tree RMB | Candidate tree RMB: Duplicate, Rename, Move up/down, Copy ID/path, Paste as child condition |
| 161 | G | scene_tree_dock.cpp : scene_tree/expand_collapse_all | Expand/collapse branch | Shift+click arrow expands branch |
| 162 | G | scene_tree_dock.cpp : delete vs delete_no_confirm (Shift+Del) | Confirming delete + bypass | Delete asks; Shift+Del skips confirm |
| 163 | G | scene_tree_dock.cpp : save_branch_as_scene | Save subtree as asset | Save condition subtree as reusable preset |
| 164 | G | scene_tree_dock.cpp : change_node_type | Change type in place | Change condition operator type keeping children |
| 165 | G | scene_tree_dock.cpp : toggle_unique_name | Mark unique (%name) | "Pin" candidate (always visible) |
| 166 | G | docks/editor_dock_manager.cpp : Dock RMB "Move Tab Left/Right", "Make Floating", "Close", "Dock Position" | Dock tab context menu | Panel-tab RMB: Move left/right, Pop out, Close, Dock to ▸ L/R/Bottom |

## 5. Sidebar (N-panel) & properties

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 167 | B | bl_category "Item" : VIEW3D_PT_context_properties / transform | Sidebar tab Item: selected object transform | Tab **Item**: selected robot pose x,y,θ, speed, holding, state at t |
| 168 | B | bl_category "Tool" : VIEW3D_PT_active_tool | Active tool settings | Tab **Tool**: ruler units, annotation pen color |
| 169 | B | bl_category "View" : view3d_properties, lock, cursor, collections | View settings | Tab **View**: FOV, follow target, grid, probe |
| 170 | B | space_view3d_sidebar.py bl_category "Animation" | Animation tab | Tab **Match**: score at t, towers ownership 1–10, block counts |
| 171 | B | properties_*.py (Properties editor contexts) | Large per-context inspector | Inspector tabs: Match, Robot, Node, Edge, Candidate, Evaluation |
| 172 | B | layout.use_property_split / decorate (all panels) | Label-left/value-right two-column layout | Inspector rows: right-aligned label, value; dense 20px rows |
| 173 | B | Panel default_closed, sub-panels (layout.panel()) | Collapsible nested panels, remember state | Collapsible sections; persist open state per user |
| 174 | B | Panel drag-reorder (header grip) | Reorder panels | Drag to reorder inspector sections |
| 175 | B | Ctrl+click panel header (collapse all others) | Solo a panel | Ctrl+click section header = collapse others |
| 176 | B | VIEW3D_PT_object_type_visibility (eye + arrow per type) | Visible/selectable icons | Same icon pair in inspector lists |
| 177 | G | settings : interface/inspector/default_property_name_style | Raw vs Capitalized vs Localized names | Toggle field names: friendly vs raw log keys |
| 178 | G | settings : interface/inspector/float_drag_speed, integer_drag_speed, default_float_step | Drag-to-scrub numbers | Number fields scrub on drag (threshold, weights) |
| 179 | G | settings : interface/inspector/disable_folding, auto_unfold_foreign_scenes | Folding behavior | Option to keep all sections expanded |
| 180 | G | settings : docks/property_editor/subresource_hue_tint | Tint nested sub-resources | Tint nested condition levels (AND/OR depth) |

## 6. Timeline & playback

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 181 | B | space_time.py : playback_controls — frame_jump (⏮ / ⏭) | Jump to start/end | ⏮ t=0 / ⏭ t=180 |
| 182 | B | playback_controls : time_jump (◂◂ / ▸▸) with time_jump_unit/delta | Step by delta (frames or seconds) | Step ±1 s (configurable: 0.1/1/5 s) |
| 183 | B | playback_controls : keyframe_jump prev/next (◆) | Jump to prev/next key | **Prev/next event** (score/capture/foul) of selected robot |
| 184 | B | playback_controls : animation_play reverse / forward; becomes Pause while playing | Play ◀ / ▶ and single Pause | ◀ reverse, ▶ play; morph into ⏸ |
| 185 | B | playback_controls : use_keyframe_insert_auto + keyframing popover | Auto-key record toggle | "Record annotations while playing" toggle |
| 186 | B | playback_controls : use_snap_playhead + TIME_PT_playhead_snapping (frames/seconds/markers/keys) | Snap playhead while scrubbing | Snap scrub to: second / event / marker |
| 187 | B | playback_controls : frame_current field | Editable current frame | Editable time field `073.4` (type to jump) |
| 188 | B | playback_controls : use_preview_range toggle + Start/End | Preview range (loops subrange) | **Range** toggle: analyse 30–60 s; Start/End fields |
| 189 | B | TIME_PT_playback : sync_mode (Play every frame / Frame dropping / Sync to audio) | A/V sync | Sync: real-time (drop frames) / every tick / sync to video |
| 190 | B | TIME_PT_playback : lock_frame_selection_to_range | Clamp scrubbing to range | "Limit to range" |
| 191 | B | TIME_PT_playback : use_follow "Follow Current Frame" | Timeline auto-scroll | Timeline follows playhead |
| 192 | B | TIME_PT_playback : playback_loop_mode | Loop behavior | Loop: none / loop / ping-pong |
| 193 | B | TIME_PT_playback : show_subframe | Subframes | Show sub-second time (ms) |
| 194 | B | TIME_PT_playback : use_audio_scrub | Audio scrubbing | Scrub match video audio |
| 195 | B | TIME_PT_playback : "Play In" editors list | Which editors update during play | Option: update graph/tables during playback (off = perf) |
| 196 | B | TIME_PT_playback_options : wrap_timeline_navigation, time_jump_unit/delta | Wrap at end, step unit | Wrap at 180 s → 0; step unit |
| 197 | B | TIME_PT_playback : anim.start_frame_set / end_frame_set | Set start/end from playhead | "Set range start/end here" (I / O keys) |
| 198 | B | TIME_MT_view : show_seconds, show_markers, show_locked_time | Timeline display opts | Time ruler: seconds vs mm:ss; markers row on/off |
| 199 | B | TIME_MT_view : show_keys_from_selected_only, show_only_errors | Key filter | Events only for selected robot |
| 200 | B | TIME_MT_view : Frame All / Frame Preview Range / Go to current (action.view_frame) | Fit timeline | Home = fit 0–180, Shift+Home = fit range, Num. = center playhead |
| 201 | B | marker menu (space_time.py marker_menu_generic) : add (M), move, rename (F2), delete, duplicate, lock_markers | Markers menu | Markers: Add (M), Rename, Move, Delete, Lock; auto-markers for score events |
| 202 | B | marker menu : marker_jump prev/next | Jump to marker | Jump prev/next marker |
| 203 | B | marker menu : marker.camera_bind | Bind camera to marker | Bind camera view to marker (auto-switch cam during replay) |
| 204 | B | DOPESHEET_MT_view : show_region_footer "Playback Controls" | Footer transport | Transport in footer below timeline |
| 205 | B | DOPESHEET_MT_view : show_sliders, show_interpolation, show_extremes | Channel display extras | Inline sparkline per track (speed), extremes markers |
| 206 | B | DOPESHEET_MT_view : previewrange_set / clear (Ctrl+P / Alt+P) | Range from selection | Range from selected events |
| 207 | B | DOPESHEET_MT_cache | Cache display | Show "evaluated" ranges as a strip under ruler |
| 208 | G | animation_player_editor_plugin.cpp : play_from_start / play / play_backwards / play_from_end / stop | 5 transport buttons: ⏮▶, ▶, ◀, ◀⏭, ⏸ | Consider "Play from start" (Shift+D) separate from resume |
| 209 | G | animation_player_editor_plugin.cpp : "Animation position (in seconds)" SpinBox | Time spinbox | as #187 |
| 210 | G | animation_player_editor_plugin.cpp : "Scale animation playback globally" | Speed scale | Speed: 0.25× 0.5× 1× 2× 4× |
| 211 | G | animation_player_editor_plugin.cpp : Onion Skinning (Past/Future, 1–3 steps, Differences Only) | Ghosts of past/future poses | **Ghost robots** at t−k / t+k steps, past=red-tinted, future=green |
| 212 | G | animation_player_editor_plugin.cpp : Pin AnimationPlayer | Pin editor to one object | Pin timeline to one robot regardless of selection |
| 213 | G | animation_track_editor.cpp : go_to_next/previous_keyframe, goto_next/prev_step | Key + step navigation | as #182/#183 |
| 214 | G | animation_track_editor.cpp : auto_fit "Fit to panel" | Fit | as #200 |
| 215 | G | animation_track_editor.cpp : "Animation step value", FPS/Seconds toggle | Snap step + unit toggle | Step value field + s/ticks toggle |
| 216 | G | animation_track_editor.cpp : "Only show tracks from nodes selected in tree" | Selection filter toggle | as #199 |
| 217 | G | animation_track_editor.cpp : "Group tracks by node or display them as plain list" | Grouping toggle | Group tracks by robot vs flat list |
| 218 | G | animation_track_editor.cpp : "Sort tracks/groups alphabetically" | Sort toggle | Sort tracks by name / alliance |
| 219 | G | animation_track_editor.cpp : filter field "Filter tracks by…" | Track filter | Track filter text |
| 220 | G | animation_track_editor.cpp : "Toggle between the bezier curve editor and track editor" | Two views of same data | Toggle event-lane view vs numeric curve view (speed/score over time) |
| 221 | G | animation_track_editor.cpp : animation_marker_edit/rename_marker, delete_selection, toggle_marker_names | Marker ops + show all names | Markers: show all names toggle |
| 222 | G | animation_track_editor.cpp : "Animation Looping" button, length (s/frames) | Loop + length in header | skip length (fixed 180 s); loop toggle |
| 223 | G | animation_track_editor.cpp : Warning labels (inactive/imported/dummy) | Inline header warning | Header warning chip: "log has gaps 41–43 s" / "unsaved" |

## 7. Outliner / scene tree

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 224 | B | OUTLINER_PT_filter : restriction toggles (enable/select/hide/viewport/render…) | Choose which per-row icon columns show | Choose row columns: visible, selectable, locked, trail |
| 225 | B | OUTLINER_PT_filter : sort_method | Alphabetical vs manual | Sort: name / alliance / score contribution |
| 226 | B | OUTLINER_PT_filter : use_sync_select, scroll_to_active, expand_on_focus | Sync + auto-scroll | Sync selection; auto-scroll to active |
| 227 | B | OUTLINER_PT_filter : show_mode_column | Mode column | skip |
| 228 | B | OUTLINER_PT_options_filter : use_filter_collection/object, filter_state (all/visible/selected/active/selectable), filter_invert | Content filters + invert | Filter: All / Visible / Selected / Active; invert |
| 229 | B | OUTLINER_PT_options_filter : object type checkboxes (Meshes, Lights, Cameras, Empties, Others) | Per-type filter | Robots / Blocks / Towers / Spots / Cameras |
| 230 | B | OUTLINER_PT_options_filter : use_filter_children | Show children | Show carried blocks under robot |
| 231 | B | OUTLINER_PT_options_search : exact match, case sensitive | Search options | Search options: exact, case |
| 232 | B | Outliner Ctrl+click eye = isolate (C-side) | Isolate via modifier click | Ctrl+click eye = solo |
| 233 | G | settings : docks/scene_tree/auto_expand_to_selected, hide_filtered_out_parents | Tree behaviors | Auto-expand to selected; hide non-matching parents when filtering |
| 234 | G | scene_tree_dock.cpp : filter field with type: prefixes | Filter field | Filter `robot:TR team:red state:carrying` |

## 8. Status bar

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 235 | B | space_statusbar.py : STATUSBAR_HT_header → template_input_status | Left: current mouse-button hints (LMB select, MMB rotate…) | Left: context hints `LMB select · RMB menu · Wheel zoom · Space play` |
| 236 | B | template_reports_banner | Middle: last report/warning (clickable → log) | Middle: last message ("Saved", "3 candidates evaluated") |
| 237 | B | template_running_jobs | Progress bar for background jobs w/ cancel | Progress bar for evaluation batch with ✕ cancel |
| 238 | B | template_status_info + prefs show_statusbar_stats/scene_duration/memory/vram/version | Right: stats, duration, memory, version | Right: `objects 4R/20B · t 73.4/180 s · 60 fps · v1.4.2` (each toggleable via RMB) |
| 239 | B | statusbar RMB → toggles (space_userpref "Status Bar" panel) | Choose status fields | RMB status bar → checkboxes |
| 240 | G | editor_node.cpp : update spinner + "Hide Update Spinner" | Spinner showing redraw activity | Tiny activity dot (redraw/eval running) |
| 241 | G | settings : interface/editor/show_internal_errors_in_toast_notifications | Toasts for errors | Toast notifications bottom-right for errors |
| 242 | G | gui/editor_bottom_panel.cpp : bottom tabs (Output, Debugger, Animation…) + editor/bottom_panel_expand | Bottom tab bar + expand | Bottom tab strip: Timeline / Log / Evaluations; expand button |
| 243 | G | editor_node.cpp : editor/toggle_last_opened_bottom_panel | Toggle bottom panel | Ctrl+J toggle bottom panel |

## 9. Preferences (categories + notable settings)

Blender categories (space_userpref.py `bl_label`s): Interface, Themes, Viewport, Lights, Editing, Animation, Add-ons/Extensions, Input, Navigation, Keymap, System, Save & Load, File Paths, Experimental.
Godot categories (settings/editor_settings.cpp key prefixes): interface/editor, interface/theme, interface/inspector, interface/touchscreen, docks/*, editors/3d, editors/3d/navigation, editors/animation, editors/panning, filesystem/*, run/*.

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 244 | B | USERPREF "Display" : ui_scale, ui_line_width | Global UI scale | Prefs > Interface: UI scale 0.8–1.5 |
| 245 | B | "Display" : show_tooltips, show_tooltips_python | Tooltips + dev tooltips | Tooltips on/off; dev tooltips show raw log keys |
| 246 | B | "Display" : show_developer_ui | Dev UI | Developer extras toggle |
| 247 | B | "Language" : language, use_translate_* | Language + what to translate | 日本語/English; translate tooltips/UI separately |
| 248 | B | "Accessibility" : use_reduce_motion | Reduce motion | Disable camera smoothing/animations |
| 249 | B | "Editors" : show_area_handle, show_navigate_ui, header_align, color_picker_type, factor_display_type | Editor chrome | Show nav gizmo; header top/bottom; percent vs factor display for probabilities |
| 250 | B | "Temporary Editors" : render/filebrowser/preferences_display_type | Open in new window vs area | Preferences open as modal vs new window |
| 251 | B | "Menus" : use_mouse_over_open, open_toplevel_delay, menu_close_leave | Hover-open menus | Menus open on hover after first click |
| 252 | B | "Pie Menus" : pie_menu_radius, pie_tap_timeout, threshold | Pie tuning | Pie radius / tap-vs-hold |
| 253 | B | "Timeline" (Animation) : view2d_grid_spacing_min, timecode_style, view_frame_type | Timecode style | Time format: `73.4 s` / `1:13.4` / ticks |
| 254 | B | "Viewport > Display" : show_object_info, show_view_name, show_playback_fps, gizmo_size, mini_axis_type/size | Viewport text + gizmo size | Same toggles; nav gizmo size |
| 255 | B | "Navigation > Orbit & Pan" : view_rotate_method (turntable/trackball), use_rotate_around_active, use_auto_perspective, use_mouse_depth_navigate, smooth_view, rotation_angle | Nav behavior | Turntable only; orbit around selected; auto-ortho on axis snap; smooth view ms |
| 256 | B | "Navigation > Zoom" : view_zoom_method, use_zoom_to_mouse, invert_zoom_wheel | Zoom behavior | Zoom to cursor; invert wheel |
| 257 | B | "Input > Mouse" : use_mouse_emulate_3_button, drag_threshold, double_click_time | Mouse emulation | "Emulate MMB with Alt" for trackpads |
| 258 | B | "Input > Touchpad" : use_multitouch_gestures, touchpad_scroll_direction | Trackpad | Pinch zoom / 2-finger orbit |
| 259 | B | "Input > Keyboard" : use_emulate_numpad | Number row as numpad | Emulate numpad (laptops) |
| 260 | B | "Keymap" + "KeyPresets" (USERPREF keymap panels) | Rebind keys, presets (Blender / Industry-compatible) | Keymap editor + presets "Default / Video-player style" |
| 261 | B | "Save & Load > Blend Files" : use_save_prompt, save_version, recent_files, use_auto_save_temporary_files, auto_save_time | Save prompt, backups, autosave timer | Autosave every N min (IndexedDB), keep N versions, confirm on close |
| 262 | B | "Memory & Limits" : undo_steps, undo_memory_limit | Undo depth | Undo steps |
| 263 | B | "Themes" : presets + per-editor colors; "Collection Colors" / color sets | Themes + tag colors | Theme light/dark/high-contrast; editable alliance colors (red/blue color-blind safe) |
| 264 | B | "Themes > Axes & Gizmos" | Gizmo colors | Axis colors |
| 265 | B | Preferences search_filter + "Save Preferences" auto-save toggle | Search prefs; auto-save prefs | Prefs search box; prefs auto-save |
| 266 | G | editors/3d/navigation/navigation_scheme (Godot/Maya/Modo/Custom), orbit/pan/zoom_mouse_button, zoom_style | Nav scheme presets | Nav preset: Blender / Maya / Map-style |
| 267 | G | editors/3d/navigation/invert_x_axis, invert_y_axis, warped_mouse_panning, emulate_numpad | Nav inversion | Invert orbit axes |
| 268 | G | editors/3d/navigation_feel/orbit_inertia, translation_inertia, zoom_inertia, sensitivity | Inertia/smoothing | Camera inertia slider |
| 269 | G | editors/3d/freelook/* (base_speed, sensitivity) | Fly speed | Fly cam speed |
| 270 | G | editors/3d/manipulator_gizmo_size / opacity | Gizmo look | Gizmo opacity |
| 271 | G | interface/editor/display_scale, main_font_size, code_font | Scale + fonts | UI font size; mono font for tables |
| 272 | G | interface/editor/save_on_focus_loss, save_each_scene_on_quit | Save triggers | Autosave on tab blur |
| 273 | G | interface/editor/update_continuously, low_processor_mode_sleep_usec | Redraw only on change | Idle = no rAF loop when paused (battery) |
| 274 | G | interface/editor/single_window_mode, separate_distraction_mode | Window behavior | skip |
| 275 | G | interface/editor/dock_tab_style, bottom_dock_tab_style | Tab text/icon/both | Panel tabs: icon / text / both |
| 276 | G | editors/animation/default_animation_step, insert_at_current_time, onion_layers_past/future_color | Anim defaults | Default step, ghost colors |
| 277 | G | editors/panning/animation_editors_panning_scheme, simple_panning | 2D pan scheme (scroll zooms vs pans) | Timeline/graph: wheel = zoom or pan |
| 278 | G | interface/touchscreen/* | Touch-specific UI | Tablet mode (bigger hit targets) |

## 10. Layout / workspaces / areas

| # | Tool | Source : symbol | What it does | Ours |
|---|---|---|---|---|
| 279 | B | TOPBAR_HT_upper_bar → workspace tabs | Workspace tabs in topbar (Layout, Modeling, Animation…) | Tabs: **Replay**, **Graph**, **Strategy**, **Conditions**, **Report** |
| 280 | B | TOPBAR_MT_workspace_menu : Duplicate, Delete, Reorder L/R/front/back, Delete All Others | Tab RMB | Workspace tab RMB: Duplicate, Rename, Delete, Reorder, Reset to default |
| 281 | B | "+" tab (workspace add from templates) | Add workspace | "+" adds workspace from template |
| 282 | B | INFO_MT_area : area_split Horizontal/Vertical | Split area | Panel menu: Split H/V |
| 283 | B | INFO_MT_area : screen_full_area Maximize (Ctrl+Space) / Restore | Maximize area | Ctrl+Space maximize hovered panel |
| 284 | B | INFO_MT_area : Focus Mode (use_hide_panels, Ctrl+Alt+Space) | Fullscreen area w/o chrome | Ctrl+Alt+Space: viewport only, no headers |
| 285 | B | INFO_MT_area : area_dupli (into new window), area_close | Pop out / close | Pop out panel / Close |
| 286 | B | INFO_MT_area : region_quadview (Ctrl+Alt+Q) | Quad view | as #87 |
| 287 | B | area corners action zones (C-side, keymap ACTIONZONE_*) | Drag corner to split/join; Ctrl-drag swap | Corner grip on panels: drag to split; drag over neighbor to merge |
| 288 | B | area edge drag; double-click edge resets? (C) | Resize areas | Resizable splitters; double-click = 50/50 |
| 289 | B | TOPBAR_HT_upper_bar : screen.back_to_previous "Back to Previous" | Exit maximized/temp screen | "Back" button shown while maximized |
| 290 | B | header RMB : Show Header / Show Tool Settings / Flip to Top/Bottom / Show Menus (C: ED_screens_header_tools_menu) | Header options | Panel header RMB: Hide header, Header top/bottom, Collapse menus |
| 291 | B | region hide arrows (small ‹ › at region edge) | Re-open hidden sidebar | Small edge tab to reopen collapsed sidebar |
| 292 | B | prefs use_load_ui | Load file's UI layout or keep current | Option: opening analysis restores its layout or keeps mine |
| 293 | G | editor_main_screen.cpp : main screen buttons 2D/3D/Script/Game/AssetLib (editor/editor_2d…) + editor_next/prev | Central editor switch with Ctrl+F1..F4 | Ctrl+1..5 workspaces |
| 294 | G | docks/editor_dock_manager.cpp : dock slots L/R/Bottom, Make Floating | Movable docks | Drag panels between slots; float |
| 295 | G | editor_node.cpp : scene tabs (open scenes as tabs w/ close ×, unsaved *) | Document tabs | Open-match tabs with `*` for unsaved |

## 11. Keymap conventions (to copy)

| # | Tool | Source : symbol | Binding → action | Ours |
|---|---|---|---|---|
| 296 | B | keymap_data/blender_default.py : screen.animation_play | Space play/pause (Shift+Ctrl+Space reverse) | Space play/pause; Shift+Space reverse |
| 297 | B | blender_default.py : screen.frame_offset | ←/→ one frame (repeat) | ←/→ step; Shift+←/→ start/end (screen.frame_jump) |
| 298 | B | blender_default.py : screen.keyframe_jump | ↑/↓ prev/next key | ↑/↓ prev/next event |
| 299 | B | blender_default.py : screen.frame_offset Alt+wheel | Alt+wheel scrubs time anywhere | Alt+wheel scrub time over any panel |
| 300 | B | blender_default.py : marker.add (M) | Add marker in every time editor | M add marker |
| 301 | B | blender_default.py : view3d.view_all (Home) / view_selected (Numpad .) | Frame | Home / . |
| 302 | B | blender_default.py : view3d.localview (/) | Isolate | / |
| 303 | B | blender_default.py : wm.search_menu (F3) | Search | F3 / Ctrl+K |
| 304 | B | blender_default.py : wm.context_toggle T / N (toolbar / sidebar keys) | Region toggles | T toolbar, N sidebar, Ctrl+J bottom |
| 305 | B | blender_default.py : screen.screen_full_area Ctrl+Space | Maximize | Ctrl+Space |
| 306 | B | blender_default.py : screen.workspace_cycle Ctrl+PgUp/PgDn | Workspace cycle | same |
| 307 | B | blender_default.py : screen.repeat_last Shift+R | Repeat | same |
| 308 | B | blender_default.py : wm.call_menu_pie helper (hold key → pie, tap → menu) | Tap/hold distinction | Z / ` / Shift+S pies |
| 309 | B | blender_default.py : wm.context_toggle Shift+Alt+Z overlays, Alt+Z xray | Overlay toggles | same |
| 310 | B | blender_default.py : view3d.view_camera Numpad 0 | Camera view | 0 = broadcast cam |
| 311 | G | animation_player_editor_plugin.cpp : D/Shift+D/A/Shift+A/S (play, from start, backwards…) defaults | Godot transport keys | Optional "Godot-like" preset |
| 312 | G | node_3d_editor_plugin.cpp : Q/W/E/R tool modes | Tool modes | Q select, M ruler |
| 313 | G | node_3d_editor_plugin.cpp : Numpad 1/3/7 (+Ctrl opposite), 5 persp | Axis views | Numpad 7 top, 1 red side, Ctrl+1 blue side |
| 314 | G | editor_node.cpp : Ctrl+Shift+P command palette, Ctrl+Shift+O quick open | Palettes | same |

---

## Highest-value picks (summary)

1. Toggle+▾popover header idiom (#61) for overlays, trails, gizmos, color-by.
2. Viewport overlays popover (#96–#107) with robot trails, fade-inactive, relationship lines, labels; X-ray (#66); color-by (#68).
3. Edge gizmos: axis ball + pan/zoom/persp/camera buttons (#92–#95); `[-] 100% [+]` zoom widget for the graph (#90).
4. Blender transport row (#181–#188) + Playback popover (#189–#197) + marker menu (#201–#203) + onion-skin ghosts (#211) + speed scale (#210).
5. Status bar 3-zone (#235–#238); workspaces + area menu (maximize/split/pop-out) (#279–#289); F3 command palette (#19); pies (#153–#155).
