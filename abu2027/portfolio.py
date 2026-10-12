"""Solve the finite policy-family matrix; requires optional scipy dependency."""
import csv
import json
from collections import defaultdict
from pathlib import Path
from .game import matrix_game


def run():
    output = Path('results/baseline')
    manifest = json.loads((output/'manifest.json').read_text())
    names = [p['name'] for p in manifest['policies']]
    index = {name:i for i,name in enumerate(names)}
    groups = defaultdict(list)
    with (output/'matches.csv').open() as f:
        for row in csv.DictReader(f):
            groups[(row['red_perf'],row['blue_perf'])].append(row)
    results = []
    for (red,blue),rows in groups.items():
        score = [[None]*(len(names)*2) for _ in names]
        win = [[None]*(len(names)*2) for _ in names]
        for row in rows:
            i,j = index[row['red_policy']],index[row['blue_policy']]*2+int(row['priority'])
            if score[i][j] is not None:
                raise ValueError('Duplicate match entry')
            score[i][j] = int(row['red_score'])-int(row['blue_score'])
            win[i][j] = int(row['winner']=='1')
        if any(x is None for row in score for x in row):
            raise ValueError('Incomplete match matrix')
        for objective,matrix in [('score_margin',score),('win_lower_bound',win)]:
            value,p = matrix_game(matrix)
            weights = sorted([{'policy':n,'probability':w} for n,w in zip(names,p) if w>1e-8],
                             key=lambda x:-x['probability'])
            results.append({'red_perf':red,'blue_perf':blue,'objective':objective,'value':value,'mixture':weights})
    (output/'portfolio.json').write_text(json.dumps({
        'scope':'Finite candidate family. Opponent chooses policy and priority against the distribution, before observing the realized initial policy. Not a solution of the full online game.',
        'unresolved_tie':'counted as not won in win_lower_bound', 'results':results},ensure_ascii=False,indent=2)+'\n')
    lines = ['# 候補作戦群内の混合戦略','',
             '比較対象の作戦と同時競合優先順を相手が選ぶ場合に、試合開始時の作戦選択を確率化した最大最小値。相手は分布を知るが、抽選結果を見る前に自分の作戦を決める仮定。実大会の勝率予測ではない。', '',
             '| 自軍 / 相手 | 期待得点差を目的とする値 | 勝ちを目的とする値 |', '|---|---:|---:|']
    for red,blue in groups:
        a = next(r for r in results if r['red_perf']==red and r['blue_perf']==blue and r['objective']=='score_margin')
        b = next(r for r in results if r['red_perf']==red and r['blue_perf']==blue and r['objective']=='win_lower_bound')
        lines.append(f"| {red} / {blue} | {a['value']:.2f}点 | {b['value']:.3f} |")
    lines += ['', '2列の最適化で選ぶ混合比は異なる場合がある。混合比はportfolio.json。定量タイブレークでも決まらない試合は「勝ちではない」と評価する。', '',
              'この値は有限候補群とマクロモデル内の保証。相手が未列挙の作戦を使う、こちらの方針を見抜いて候補外の切替を行う、経路や衝突が影響する場合の保証はない。']
    (output/'portfolio.md').write_text('\n'.join(lines)+'\n')
    print('\n'.join(lines))


if __name__=='__main__':
    run()
