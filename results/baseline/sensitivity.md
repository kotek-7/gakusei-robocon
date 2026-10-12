# 所要時間の感度分析

相手はreference固定。自軍は3つの作戦を固定し、一系統の所要時間だけ変更した。各点で108相手×優先順2通りを比較。実機に必要十分な性能の証明ではない。

3作戦: PUS-M1Q0-F0-skyfirst, SPU-M1Q1-F120-balanced, PUS-M0-F120-skyfirst

| 短縮・延長する動作 | 倍率 | 3候補中の最良作戦 | 最悪得点差 | 平均得点差 |
|---|---:|---|---:|---:|
| TR搬送 | 0.5 | PUS-M1Q0-F0-skyfirst | -240 | 307.22 |
| TR搬送 | 0.75 | PUS-M0-F120-skyfirst | -270 | -0.83 |
| TR搬送 | 1.0 | SPU-M1Q1-F120-balanced | -200 | 145.44 |
| TR搬送 | 1.25 | PUS-M1Q0-F0-skyfirst | -360 | 148.26 |
| TR搬送 | 1.5 | PUS-M1Q0-F0-skyfirst | -370 | 52.66 |
| BR建設 | 0.5 | PUS-M1Q0-F0-skyfirst | -140 | 366.3 |
| BR建設 | 0.75 | PUS-M1Q0-F0-skyfirst | -270 | 261.25 |
| BR建設 | 1.0 | SPU-M1Q1-F120-balanced | -200 | 145.44 |
| BR建設 | 1.25 | SPU-M1Q1-F120-balanced | -330 | 69.68 |
| BR建設 | 1.5 | PUS-M1Q0-F0-skyfirst | -320 | 51.16 |
| L2追加時間 | 0.5 | PUS-M1Q0-F0-skyfirst | -230 | 294.98 |
| L2追加時間 | 0.75 | PUS-M1Q0-F0-skyfirst | -270 | 242.75 |
| L2追加時間 | 1.0 | SPU-M1Q1-F120-balanced | -200 | 145.44 |
| L2追加時間 | 1.25 | SPU-M1Q1-F120-balanced | -280 | 122.62 |
| L2追加時間 | 1.5 | SPU-M1Q1-F120-balanced | -280 | 107.22 |
| Sky反転 | 0.5 | PUS-M0-F120-skyfirst | -190 | 40.79 |
| Sky反転 | 0.75 | PUS-M0-F120-skyfirst | -215 | 5.79 |
| Sky反転 | 1.0 | SPU-M1Q1-F120-balanced | -200 | 145.44 |
| Sky反転 | 1.25 | SPU-M1Q1-F120-balanced | -315 | 107.73 |
| Sky反転 | 1.5 | PUS-M0-F120-skyfirst | -340 | -45.0 |
| Mustika搬送奉納 | 0.5 | SPU-M1Q1-F120-balanced | -200 | 155.74 |
| Mustika搬送奉納 | 0.75 | SPU-M1Q1-F120-balanced | -200 | 151.74 |
| Mustika搬送奉納 | 1.0 | SPU-M1Q1-F120-balanced | -200 | 145.44 |
| Mustika搬送奉納 | 1.25 | SPU-M1Q1-F120-balanced | -200 | 133.4 |
| Mustika搬送奉納 | 1.5 | SPU-M1Q1-F120-balanced | -200 | 98.68 |

倍率は各パラメータに掛け、整数秒へ丸めた。実際の秒数はsensitivity.jsonに保存。0.5倍は所要時間半減。最悪得点差が正なら、この比較対象内で全勝したことを示す。未列挙の作戦・物理制約に対する保証ではない。

一系統の短縮でも、行動のタイミングや選択が変わるため単調に改善するとは限らない。複数系統の同時変更・方策の再最適化は別実験が必要。
