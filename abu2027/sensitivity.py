"""One-factor duration sweeps, keeping opponent performance at reference."""
import csv
import json
from dataclasses import replace, asdict
from pathlib import Path
from .model import Performance, scores, winner
from .search import policies, simulate


def run():
    out = Path('results/baseline')
    rankings = json.loads((out/'rankings.json').read_text())
    table = next(x for x in rankings if x['red_perf']==x['blue_perf']=='reference')['ranking']
    candidates = policies()
    lookup = {p.name:p for p in candidates}
    # Best candidate in each of three disjoint policy classes, selected at baseline.
    selected = []
    for predicate in (lambda p:p.mission and p.flip_at==0,
                      lambda p:p.mission and p.flip_at==120,
                      lambda p:not p.mission):
        selected.append(next(lookup[r['policy']] for r in table if predicate(lookup[r['policy']])))
    baseline = next(x for x in json.loads(Path('configs/performances.json').read_text()) if x['name']=='reference')
    ref = Performance(**baseline)
    groups = {'TR搬送':('transfer','collect','mixed'), 'BR建設':('earth','second','sky'),
              'L2追加時間':('upper',), 'Sky反転':('flip',), 'Mustika搬送奉納':('mustika_tr','mustika_br')}
    results = []
    for group, keys in groups.items():
        for scale in (0.5,0.75,1.0,1.25,1.5):
            actual = {k:max(1,round(getattr(ref,k)*scale)) for k in keys}
            p = replace(ref,**actual)
            for red in selected:
                margins, wins, mission_times = [],0,[]
                for blue in candidates:
                    for priority in (0,1):
                        s = simulate(red,blue,(p,ref),priority=priority)
                        margins.append(scores(s)[0]-scores(s)[1])
                        wins += winner(s)==1
                        if s.mustika=='placed0':
                            mission_times.append(s.mustika_at)
                results.append({'group':group,'scale':scale,'seconds':actual,'policy':red.name,
                                'worst_margin':min(margins),'mean_margin':round(sum(margins)/len(margins),2),
                                'wins':wins,'matches':len(margins),'missions':len(mission_times),
                                'earliest_mustika':min(mission_times,default=None)})
        print(f"sweep complete: {group}",flush=True)
    (out/'sensitivity.json').write_text(json.dumps({'baseline':asdict(ref),'selected':[p.name for p in selected],
        'scope':'fixed three policies, 108 opponents, both priorities; one factor at a time; not necessary or sufficient real-robot bounds',
        'results':results},ensure_ascii=False,indent=2)+'\n')
    lines = ['# 所要時間の感度分析','',
             '相手はreference固定。自軍は3つの作戦を固定し、一系統の所要時間だけ変更した。各点で108相手×優先順2通りを比較。実機に必要十分な性能の証明ではない。', '',
             '3作戦: '+', '.join(p.name for p in selected),'',
             '| 短縮・延長する動作 | 倍率 | 3候補中の最良作戦 | 最悪得点差 | 平均得点差 |','|---|---:|---|---:|---:|']
    for group in groups:
        for scale in (0.5,0.75,1.0,1.25,1.5):
            best = max((r for r in results if r['group']==group and r['scale']==scale),key=lambda r:(r['worst_margin'],r['mean_margin']))
            lines.append(f"| {group} | {scale} | {best['policy']} | {best['worst_margin']} | {best['mean_margin']} |")
    lines += ['', '倍率は各パラメータに掛け、整数秒へ丸めた。実際の秒数はsensitivity.jsonに保存。0.5倍は所要時間半減。最悪得点差が正なら、この比較対象内で全勝したことを示す。未列挙の作戦・物理制約に対する保証ではない。', '',
              '一系統の短縮でも、行動のタイミングや選択が変わるため単調に改善するとは限らない。複数系統の同時変更・方策の再最適化は別実験が必要。']
    (out/'sensitivity.md').write_text('\n'.join(lines)+'\n')


if __name__=='__main__':
    run()
