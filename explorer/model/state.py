"""Serializable continuation states. Replay and scoring read these same objects."""

from copy import deepcopy
import json
from .field import NODES, SPOTS

ROBOT_NAMES = ("赤TR", "赤BR", "青TR", "青BR")


def key(s):
    return json.dumps(s, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def initial(config, variant):
    if config["scenario"] == "custom":
        s = deepcopy(config["root"])
        validate(s)
        return s
    robots = []
    for r in range(4):
        team, role = divmod(r, 2)
        swap = (variant["start"] >> team) & 1
        robots.append(
            {
                "pos": f"start{'B' if role ^ swap else 'A'}{team}",
                "job": None,
                "entered": False,
                "waited": False,
            }
        )
    objects = []
    for i in range(40):
        team = i // 20
        j = i % 20
        objects.append(
            {
                "id": i,
                "kind": "E",
                "owner": team,
                "loc": f"store{team}",
                "slot": j // 2 if variant["layout"] == "stacked" else j,
                "layer": j % 2 if variant["layout"] == "stacked" else 0,
                "face": team,
                "delivered": [False, False],
            }
        )
    for i in range(12):
        objects.append(
            {
                "id": 40 + i,
                "kind": "S",
                "owner": -1,
                "loc": "groundSky",
                "slot": i,
                "layer": 0,
                "face": -1,
                "delivered": [False, False],
            }
        )
    objects.append(
        {
            "id": 52,
            "kind": "M",
            "owner": -1,
            "loc": "groundBall",
            "slot": 0,
            "layer": 0,
            "face": -1,
            "delivered": [False, False],
        }
    )
    s = {
        "t": 0,
        "robots": robots,
        "objects": objects,
        "mandate": [False, False],
        "ever": [[], []],
        "transfer": [0, 0],
    }
    if config["scenario"] == "endgame":
        s["t"] = 174
        for r in range(4):
            s["robots"][r]["pos"] = f"{'transfer' if r % 2 == 0 else 'spot4-'}{r // 2}"
            s["robots"][r]["entered"] = bool(r % 2)
        for ids, spot, owner in [([0, 1, 40], 0, 0), ([20, 21, 41], 4, 1)]:
            for layer, oid in enumerate(ids):
                o = objects[oid]
                o.update(
                    loc=f"tower{spot}",
                    layer=layer,
                    face=owner,
                    delivered=[owner == 0, owner == 1],
                )
            s["transfer"][owner] += 3
        qualify(s, config["rules"])
    return s


def payload(s, r):
    return [o for o in s["objects"] if o["loc"] == f"robot{r}"]


def tower(s, i):
    return sorted(
        [o for o in s["objects"] if o["loc"] == f"tower{i}"], key=lambda o: o["layer"]
    )


def qualify(s, rules):
    for team in (0, 1):
        owned = [
            i
            for i in range(10)
            if len(tower(s, i)) == 3 and tower(s, i)[-1]["face"] == team
        ]
        s["ever"][team] = sorted(set(s["ever"][team]) | set(owned))
        considered = s["ever"][team] if rules["mandate"] == "historical" else owned
        if len(considered) >= 2 and any(SPOTS[i][4] == -1 for i in considered):
            s["mandate"][team] = True


def scores(s):
    points = [5 * x for x in s["transfer"]]
    for i in range(10):
        for o in tower(s, i):
            if o["kind"] == "E":
                points[o["owner"]] += (10, 20)[o["layer"]] * SPOTS[i][3]
            elif o["face"] in (0, 1):
                points[o["face"]] += 40 * SPOTS[i][3]
    m = s["objects"][52]
    if m["loc"] == "pillar":
        points[m["owner"]] += 250
    return points


def ranks(s):
    result = []
    for team in (0, 1):
        counts = [0, 0]
        caps = 0
        for i in range(10):
            for o in tower(s, i):
                owned = o["owner"] == team if o["kind"] == "E" else o["face"] == team
                counts[SPOTS[i][3] - 1] += int(owned)
                caps += int(o["kind"] == "S" and o["face"] == team)
        result.append(
            [
                scores(s)[team],
                int(
                    s["objects"][52]["loc"] == "pillar"
                    and s["objects"][52]["owner"] == team
                ),
                caps,
                counts[1],
                counts[0],
            ]
        )
    return result


def winner(s):
    a, b = ranks(s)
    return (a > b) - (a < b)


def validate(s):
    if not isinstance(s, dict) or set(s) != {
        "t",
        "robots",
        "objects",
        "mandate",
        "ever",
        "transfer",
    }:
        raise ValueError("局面データの項目が不正です")
    if type(s.get("t")) is not int or not 0 <= s["t"] <= 180:
        raise ValueError("局面の時刻が不正です")
    if len(s["objects"]) != 53 or [o["id"] for o in s["objects"]] != list(range(53)):
        raise ValueError("競技物体の個数またはIDが不正です")
    if len(s["robots"]) != 4:
        raise ValueError("両チーム合わせて4台の機体が必要です")
    if len(s["mandate"]) != 2 or any(type(v) is not bool for v in s["mandate"]):
        raise ValueError("ムスティカ取得条件の成立状態が不正です")
    if len(s["transfer"]) != 2 or any(
        type(v) is not int or v < 0 for v in s["transfer"]
    ):
        raise ValueError("受け渡し得点が不正です")
    if len(s["ever"]) != 2 or any(
        any(type(i) is not int or i not in range(10) for i in a) for a in s["ever"]
    ):
        raise ValueError("タワーの完成履歴が不正です")
    for i, r in enumerate(s["robots"]):
        if (
            r["pos"] not in NODES
            or NODES[r["pos"]]["team"] not in (-1, i // 2)
            or ("BR" if i % 2 else "TR") not in NODES[r["pos"]]["roles"]
        ):
            raise ValueError("機体の位置が不正です")
        if type(r["entered"]) is not bool or type(r["waited"]) is not bool:
            raise ValueError("機体の進入・待機状態が不正です")
        if r["job"]:
            j = r["job"]
            if (
                type(j["end"]) is not int
                or not s["t"] < j["end"]
                or type(j["start"]) is not int
                or not 0 <= j["start"] <= s["t"]
            ):
                raise ValueError("実行中の動作の時刻が不正です")
    places = (
        {"groundSky", "groundBall", "pillar", "store0", "store1", "buffer0", "buffer1"}
        | {f"robot{i}" for i in range(4)}
        | {f"tower{i}" for i in range(10)}
    )
    for o in s["objects"]:
        kind = "E" if o["id"] < 40 else "S" if o["id"] < 52 else "M"
        if o["kind"] != kind or o["loc"] not in places:
            raise ValueError("競技物体の種類または所在が不正です")
        if (
            type(o["owner"]) is not int
            or o["owner"] not in (-1, 0, 1)
            or type(o["face"]) is not int
            or o["face"] not in (-1, 0, 1)
        ):
            raise ValueError("競技物体の所属または色が不正です")
        if kind == "E" and o["owner"] != o["id"] // 20:
            raise ValueError("アースブロックの所属が元のチームと一致しません")
        if len(o["delivered"]) != 2 or any(type(v) is not bool for v in o["delivered"]):
            raise ValueError("受け渡し得点の加点履歴が不正です")
        if (
            type(o["layer"]) is not int
            or o["layer"] < 0
            or type(o["slot"]) is not int
            or o["slot"] < 0
        ):
            raise ValueError("競技物体の段数または配置番号が不正です")
        if o["loc"] == "pillar" and (
            kind != "M" or o["owner"] not in (0, 1) or not s["mandate"][o["owner"]]
        ):
            raise ValueError("中央柱へのムスティカの設置状態が不正です")
        if kind == "M" and o["loc"] not in {
            "groundBall",
            "pillar",
            "buffer0",
            "buffer1",
            "robot0",
            "robot1",
            "robot2",
            "robot3",
        }:
            raise ValueError("ムスティカの所在が不正です")
    for i in range(10):
        ts = tower(s, i)
        if (
            len(ts) > 3
            or [o["layer"] for o in ts] != list(range(len(ts)))
            or any(o["kind"] != ("S" if k == 2 else "E") for k, o in enumerate(ts))
        ):
            raise ValueError("タワーの積み順が不正です")
    for r in range(4):
        ps = payload(s, r)
        if (
            sum(o["kind"] != "M" for o in ps) > (3 if r % 2 == 0 else 2)
            or any(o["kind"] == "M" for o in ps)
            and len(ps) > 1
        ):
            raise ValueError("積載数の上限または混載条件を満たしていません")


def snapshot(s):
    return {"state": s, "scores": scores(s), "ranks": ranks(s), "winner": winner(s)}
