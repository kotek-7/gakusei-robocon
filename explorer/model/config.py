"""Versioned finite domains. Performance values are assumptions, never measured claims."""

from copy import deepcopy
import math

VERSION = "resource-events-2"


CAPS = {
    "ramp": True,
    "stairs1": True,
    "stairs2": True,
    "flip": True,
    "reposition": True,
    "earth": True,
    "sky": True,
    "mustika": True,
    "direct": True,
    "mixed": True,
    "capacity_tr": 3,
    "capacity_br": 2,
}
CAP_LABELS = {
    "ramp": "GND–L1 スロープ",
    "stairs1": "GND–L1 階段",
    "stairs2": "L1–L2 階段",
    "flip": "スカイブロックを裏返す",
    "reposition": "持ち直す・置き直す",
    "earth": "アースブロックを扱う",
    "sky": "スカイブロックを扱う",
    "mustika": "ムスティカを扱う",
    "direct": "直接受け渡し",
    "mixed": "アースブロック・スカイブロックの混載",
    "capacity_tr": "TR積載数",
    "capacity_br": "BR積載数",
}
PROFILES = {
    "move": [0.8, 0.5, 0.3],
    "pick": [1, 2, 4],
    "place": [2, 4, 7],
    "flip": [2, 4, 8],
    "handover": [1, 2, 4],
    "retry": [5, 10, 15],
}
PROFILE_LABELS = {
    "move": "走行速度 m/s",
    "pick": "取得 秒",
    "place": "設置 秒",
    "flip": "裏返す 秒",
    "handover": "受け渡し 秒",
    "retry": "リトライ 秒",
}
RULES = {
    "retry_payload": "retain",
    "br_ramp": False,
    "sky_relocate": False,
    "repeat_transfer": False,
    "placed_mustika": False,
    "conflict": "branch",
    "mandate": "simultaneous",
}
RULE_OPTIONS = {
    "retry_payload": (["retain", "return"], "リトライ時のブロック", "5.1.1 / 5.3.2"),
    "br_ramp": ([False, True], "BRスロープ利用", "4.3.2"),
    "sky_relocate": ([False, True], "スカイブロックの別スポットへの移設", "3.5.8"),
    "repeat_transfer": ([False, True], "同じ競技物体への受け渡し得点の再加算", "8.1"),
    "placed_mustika": ([False, True], "設置済みムスティカの取り外し", "明文未確認"),
    "conflict": (["branch", "red", "blue"], "同時取得・操作の競合", "6.6 / モデル仮定"),
    "mandate": (
        ["simultaneous", "historical"],
        "ムスティカ取得条件のタワー数判定",
        "3.6.1–2",
    ),
}


def defaults():
    return {
        "version": VERSION,
        "name": "新しい探索",
        "scenario": "start",
        "horizon": 180,
        "rules": deepcopy(RULES),
        "profiles": deepcopy(PROFILES),
        "teams": [
            {
                "caps": {k: [v] for k, v in CAPS.items()},
                "speeds": {k: [1] for k in PROFILES},
            }
            for _ in range(2)
        ],
        "starts": [0],
        "layouts": ["stacked"],
    }


def validate(c):
    if not isinstance(c, dict):
        raise ValueError("条件JSONはオブジェクトで指定してください")
    if c.get("version") != VERSION:
        raise ValueError("モデルの版が一致しません")
    if c.get("scenario") not in ("start", "endgame", "custom"):
        raise ValueError("初期局面が不正です")
    if type(c.get("horizon")) is not int or not 1 <= c["horizon"] <= 180:
        raise ValueError("終了時刻は1〜180秒です")
    if c["scenario"] == "custom":
        from .state import validate as validate_state

        validate_state(c.get("root"))
        if any(r["job"] for r in c["root"]["robots"]):
            raise ValueError("指定初期局面は全機体の動作終了時にしてください")
        if c["root"]["t"] > c["horizon"]:
            raise ValueError("初期局面が終了時刻を超えています")
    if c["scenario"] == "endgame" and c["horizon"] < 174:
        raise ValueError("終盤局面は174秒からです")
    if not isinstance(c.get("name"), str) or not 1 <= len(c["name"]) <= 100:
        raise ValueError("探索名は1〜100文字です")
    if set(c.get("rules", {})) != set(RULES):
        raise ValueError("規則設定が不足しています")
    for k, (opts, _, _) in RULE_OPTIONS.items():
        if not any(type(c["rules"][k]) is type(x) and c["rules"][k] == x for x in opts):
            raise ValueError(f"不正なルール設定: {RULE_OPTIONS[k][1]}")
    if set(c.get("profiles", {})) != set(PROFILES):
        raise ValueError("数値プロファイルが不足しています")
    for k, vals in c["profiles"].items():
        if (
            not isinstance(vals, list)
            or len(vals) != 3
            or any(
                type(v) not in (int, float) or not math.isfinite(v) or v <= 0 or v > 300
                for v in vals
            )
        ):
            raise ValueError(f"正の3段階値が必要です: {PROFILE_LABELS[k]}")
    if len(c.get("teams", [])) != 2:
        raise ValueError("赤青の2構成が必要です")
    for team in c["teams"]:
        if set(team.get("caps", {})) != set(CAPS) or set(team.get("speeds", {})) != set(
            PROFILES
        ):
            raise ValueError("構成項目が不足しています")
        for k, vals in team["caps"].items():
            allowed = (
                list(range(4 if k == "capacity_tr" else 3))
                if k.startswith("capacity")
                else [False, True]
            )
            if (
                not vals
                or len(vals) != len(set(vals))
                or any(
                    not any(type(v) is type(x) and v == x for x in allowed)
                    for v in vals
                )
            ):
                raise ValueError(f"不正な能力設定: {CAP_LABELS[k]}")
        for k, vals in team["speeds"].items():
            if (
                not vals
                or len(vals) != len(set(vals))
                or any(type(v) is not int or v not in (0, 1, 2) for v in vals)
            ):
                raise ValueError(f"不正な段階設定: {PROFILE_LABELS[k]}")
    for key, allowed in [("starts", [0, 1, 2, 3]), ("layouts", ["stacked", "single"])]:
        vals = c.get(key)
        if (
            not isinstance(vals, list)
            or not vals
            or len(vals) != len(set(vals))
            or any(v not in allowed for v in vals)
        ):
            raise ValueError(f"不正な初期配置: {key}")
    if c["scenario"] == "custom":
        from .state import payload
        from .actions import fits

        for r in range(4):
            caps = {k: min(vals) for k, vals in c["teams"][r // 2]["caps"].items()}
            if not fits(payload(c["root"], r), caps, r % 2):
                raise ValueError("指定局面の積載物を扱えない構成が含まれています")
    return c


def dimensions(c):
    dims = []
    for t in range(2):
        for k in CAPS:
            dims.append((t, "caps", k, c["teams"][t]["caps"][k]))
        for k in PROFILES:
            dims.append((t, "speeds", k, c["teams"][t]["speeds"][k]))
    dims += [(-1, "", "start", c["starts"]), (-1, "", "layout", c["layouts"])]
    return dims


def count_configs(c):
    return math.prod(len(d[3]) for d in dimensions(c))


def config_at(c, index):
    if not 0 <= index < count_configs(c):
        raise ValueError("構成番号が範囲外です")
    out = {"teams": [{"caps": {}, "speeds": {}}, {"caps": {}, "speeds": {}}]}
    for t, kind, k, vals in reversed(dimensions(c)):
        index, j = divmod(index, len(vals))
        v = vals[j]
        if t < 0:
            out[k] = v
        else:
            out["teams"][t][kind][k] = v
    return out


def metadata():
    return {
        "version": VERSION,
        "defaults": defaults(),
        "caps": CAP_LABELS,
        "profiles": PROFILE_LABELS,
        "rules": {
            k: {"options": v[0], "label": v[1], "source": v[2]}
            for k, v in RULE_OPTIONS.items()
        },
        "scope": [
            "位置・経路・初期配置は有限候補",
            "成功動作のみ。動作完了後のリトライを含む",
            "資源・イベントモデル：秒単位で計時し、動作完了・試合終了まで進めます",
            "待機は次の動作完了まで。通常動作中の任意リトライ・任意時刻の再判断は対象外",
            "同等な物体は個数と属性で選択し、共有在庫は接触時に割り当てます",
            "全盤面観測。相手の今回の選択は非公開",
            "経路は代表機体の通路。接触力学・転倒・把持軌道は対象外",
            "数値は仮定。速い／標準／遅いの3段階は項目ごとに独立",
            "未確定解釈の選択肢は公式裁定ではありません",
        ],
    }
