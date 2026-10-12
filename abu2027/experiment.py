"""Reproducible CLI: python3 -m abu2027.experiment."""
import argparse
import csv
from dataclasses import asdict, replace
import json
import hashlib
import platform
from pathlib import Path
import time

from .model import Performance, State, Tower, scores, winner, update_mandate, invariant
from .search import policies, simulate, exhaustive


def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def endgame():
    s = State(t=174)
    s.towers[0] = Tower([0, 0], 0)
    s.towers[6] = Tower([1, 1], 1)
    s.towers[7] = Tower([1, 1], 1)
    s.earth_stock = [18, 16]
    s.sky_stock = 9
    s.transfers = [3, 6]
    update_mandate(s)
    invariant(s)
    return s


def run(config, output):
    output.mkdir(parents=True, exist_ok=True)
    profiles = [Performance(**p) for p in json.loads(config.read_text())]
    by_name = {p.name: p for p in profiles}
    if "reference" not in by_name:
        raise ValueError("A reference profile is required")
    candidates = policies()
    dump(output / "manifest.json", {
        "model": "macro-v3-qualification-choice", "rule_source": json.loads(Path('docs/sources.json').read_text()),
        "python": platform.python_version(),
        "source_sha256": {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path('abu2027').glob('*.py'))},
        "profiles": [asdict(p) for p in profiles], "policies": [asdict(p) | {"name": p.name} for p in candidates],
        "priorities": [0, 1], "duration": 180,
        "coverage": "All 108x108 policy pairs at both tie priorities per scenario. NOT all legal match histories or all feedback policies.",
        "profile_status": "assumed, not measured", "failure_sampling_seeds": list(range(40))})
    scenarios = [(p, p) for p in profiles]
    scenarios += [(p, by_name['reference']) for p in profiles if p.name != 'reference']
    summaries = []
    total = 0
    tic = time.monotonic()
    with (output / 'matches.csv').open('w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['red_perf','blue_perf','red_policy','blue_policy','priority','red_score','blue_score','winner','red_mandate_s','blue_mandate_s','mustika','mustika_s'])
        for red_perf, blue_perf in scenarios:
            rows = []
            for red in candidates:
                diffs, wins, missions, unlocks = [], 0, [], []
                for blue in candidates:
                    for priority in (0,1):
                        s = simulate(red, blue, (red_perf, blue_perf), priority=priority)
                        points = scores(s)
                        writer.writerow([red_perf.name, blue_perf.name, red.name, blue.name, priority, *points,
                                         winner(s), *s.mandate_at, s.mustika, s.mustika_at])
                        diffs.append(points[0] - points[1])
                        wins += int(winner(s) == 1)
                        if s.mustika == 'placed0':
                            missions.append(s.mustika_at)
                        if s.mandate_at[0] is not None:
                            unlocks.append(s.mandate_at[0])
                        total += 1
                rows.append({'policy': red.name, 'min_margin': min(diffs), 'mean_margin': round(sum(diffs)/len(diffs),2),
                             'wins': wins, 'matches': len(diffs), 'missions': len(missions),
                             'earliest_mustika': min(missions, default=None), 'earliest_unlock': min(unlocks, default=None)})
            rows.sort(key=lambda r:(r['min_margin'],r['mean_margin']), reverse=True)
            summaries.append({'red_perf':red_perf.name,'blue_perf':blue_perf.name,'ranking':rows})
            f.flush()
            print(f"{red_perf.name} vs {blue_perf.name}: {total} matches, leader {rows[0]['policy']}, worst {rows[0]['min_margin']}, {time.monotonic()-tic:.1f}s",flush=True)
    dump(output / 'rankings.json', summaries)

    ref = by_name['reference']
    ref_summary = next(s for s in summaries if s['red_perf'] == s['blue_perf'] == 'reference')
    lookup = {p.name:p for p in candidates}
    champion = lookup[ref_summary['ranking'][0]['policy']]
    # Worst opponent and a trace, selected after exhaustive comparison within family.
    encounters = [(scores(s)[0]-scores(s)[1], blue, priority, s)
                  for blue in candidates for priority in (0,1)
                  for s in [simulate(champion,blue,(ref,ref),priority=priority)]]
    _, adversary, priority, _ = min(encounters, key=lambda x:x[0])
    trace = simulate(champion,adversary,(ref,ref),priority=priority,record=True,check=True)
    dump(output / 'example_match.json', {'red_policy':champion.name,'blue_policy':adversary.name,
                                        'priority':priority,'score':scores(trace),'events':trace.trace})

    # Finite, repeatable stochastic sample. No claim of exhaustive failure outcomes.
    reliability = []
    for success in (1.0,0.95,0.9,0.8):
        p = replace(ref, success=success)
        for name in [r['policy'] for r in ref_summary['ranking'][:5]]:
            diffs, wins = [], 0
            for seed in range(40):
                for first in (0,1):
                    s = simulate(lookup[name],adversary,(p,ref),priority=first,seed=seed,check=True)
                    diffs.append(scores(s)[0]-scores(s)[1])
                    wins += winner(s)==1
            reliability.append({'policy':name,'action_success_assumption':success,'opponent':adversary.name,
                                'n':len(diffs),'sample_wins':wins,'mean_margin':round(sum(diffs)/len(diffs),2),
                                'min_sample_margin':min(diffs)})
    dump(output/'reliability.json',reliability)

    # Short, fully enumerated local game. TR held inactive by scenario definition.
    p = replace(ref,flip=1,upper=1)
    exact = [exhaustive(endgame(),(p,p),active=(1,3),priority=i) for i in (0,1)]
    dump(output/'exact_endgame.json',{'scenario':asdict(endgame()),'performance':asdict(p),'searches':exact})
    report = ["# ABU 2027 作戦探索・初回実験", "",
              "所要時間は仮定。実機性能・国内大会ルールへの適合を検証した結果ではない。", "",
              f"108作戦 × 108相手作戦 × 同時競合優先順2通り × {len(scenarios)}性能条件 = **{total:,}試合**。",
              "この有限作戦群内の総当たりは完了。全合法試合展開・全戦略の探索は未完了。", "",
              "## 性能条件ごとの候補", "",
              "最悪得点差を優先し、同点なら平均得点差で順位付け。平均は候補群への等重みで、実大会の勝率ではない。", "",
              "| 自軍 / 相手 | 作戦 | 最悪得点差 | 平均得点差 | 勝ち / 比較数 | 最速Mustika |",
              "|---|---|---:|---:|---:|---:|"]
    for scenario in summaries:
        r = scenario['ranking'][0]
        report.append(f"| {scenario['red_perf']} / {scenario['blue_perf']} | {r['policy']} | {r['min_margin']} | {r['mean_margin']} | {r['wins']}/{r['matches']} | {r['earliest_mustika']} |")
    report += ["", "P=自陣L1、S=共有L1、U=L2。左から建設優先順位。M1=Mustika取得、M0=取得しない。Q1=資格取得優先で、自陣塔1本の次は共有塔へ進み、反転で直ちに資格が得られるなら時刻制限に優先する。Q0=通常の建設・反転順序を守る。F0=常時反転優先、F120=120秒以降、F181=資格目的以外の反転なし。balanced=Earth2個+Sky1個を優先、skyfirst=Sky先行。", "",
               "## 終盤の完全探索", "",
               "174秒時点から6秒間、自軍の自陣L1完成塔1本、相手のL2完成塔2本、BRの手元在庫なし。TRの行動を停止し、BRの待機と反転を全列挙。L2反転は仮に2秒。", ""]
    for r in exact:
        report.append(f"- 優先チーム{r['priority']}: 完了={r['complete']}、{r['states']:,}状態、{r['edges']:,}遷移、終端勝敗分布={r['terminal_states_by_winner']}")
    report += ["", "終端分布は到達可能な状態数。勝率・最適戦略を意味しない。", "",
               "## 信頼性の試行", "",
               "reference上位5作戦を、首位作戦の最悪相手1作戦に対して、動作成功率1.0/0.95/0.9/0.8、40 seed×優先順2通りで評価。詳細は reliability.json。失敗時は追加の復帰時間を課す仮定であり、公式リトライの厳密再現ではない。", "",
               "## 解釈の範囲", "",
               "同じ建設地点の同時操作は先着予約で直列化する。移動・把持・昇段はまとめた所要時間。衝突、経路、転倒、Transfer Areaの収容制約、任意の積み直し、Skyの撤去・移設、戦術的リトライ、観測誤差を含まない。これらを含む実競技の最適性は証明していない。", "",
               "実験条件は manifest.json、全試合は matches.csv、各条件の全順位は rankings.json、再生用の時系列は example_match.json。ルールと仮定は docs/model.md を参照。"]
    (output/'report.md').write_text('\n'.join(report)+'\n')
    print(f"Done: {output/'report.md'}",flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--config',type=Path,default=Path('configs/performances.json'))
    parser.add_argument('--output',type=Path,default=Path('results/baseline'))
    args = parser.parse_args()
    run(args.config,args.output)
