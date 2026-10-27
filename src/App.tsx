import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { DREAMS, REFLECTION_QUESTIONS, ROLES, RULES } from './game/data';
import { chooseStrategy, createGame, executePlan, finishGame, getActions, getDream, getEnding, getEvent, getProgress, isGoalComplete, nextRound, previewPlan, toggleAction } from './game/engine';
import type { Dream, DreamId, Game, Stats } from './game/types';
import { emptySave, loadSaved, removeData, saveData, upsertResult } from './game/storage';

const STAT_LABELS: Record<keyof Stats, string> = { money: '資金', skill: 'スキル', support: '人とのつながり', health: '心身の状態', satisfaction: '本人の満足度' };
const STAT_KEYS: (keyof Stats)[] = ['money', 'skill', 'support', 'health', 'satisfaction'];
const DREAM_COLORS = { cafe: ['#edf0e4', '#5c7659'], manga: ['#f8ece3', '#b76c4d'], music: ['#e7edf4', '#627e9a'] };
const ACTION_ICONS: Record<string, string> = { study: '✎', consult: '☏', work: '↗', rest: '☀', talk: '♡', reflect: '◎' };
const delta = (n: number) => `${n > 0 ? '+' : ''}${n}`;
const moneyLabel = (cost: number) => cost === 0 ? '資金 0' : cost < 0 ? `資金 +${-cost}` : `資金 −${cost}`;

function DreamArt({ id }: { id: DreamId }) {
  return <svg viewBox="0 0 240 150" aria-hidden="true" fill="none" className="dream-illustration">
    <circle cx="126" cy="71" r="53" fill="currentColor" opacity=".08" />
    <path d="M44 126h152" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".3" />
    {id === 'cafe' ? <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M78 70h69v26a25 25 0 0 1-25 25h-19a25 25 0 0 1-25-25Z" fill="#fffdf6" /><path d="M148 76h9a14 14 0 0 1 0 28h-13M68 121h96M98 56c-12-12 12-14 0-26M120 56c-12-12 12-14 0-26" /><path d="m179 103 2-30m-2 18c-19 1-19-17-19-17 16 0 21 8 21 8m0-5c17-2 16-17 16-17-15 2-16 17-16 17" strokeWidth="2" />
    </g> : id === 'manga' ? <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M68 46h88v77H68z" fill="#fffaf6" transform="rotate(-8 112 84)" /><path d="M82 52h88v73H82z" fill="#fffaf6" /><path d="M92 64h30v27H92zm41 0h26v27h-26zm-41 38h66m-66 10h44M184 89l-4 22 12-17 13-39-8-3Z" /><path d="m101 81 7-9 7 9m26-5h10m-5-5v10" strokeWidth="2" />
    </g> : <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M73 121V65m-11-8h22v19a11 11 0 0 1-22 0ZM66 48a7 7 0 0 1 14 0v9H66zM57 121h32m51-39V41l41-8v41m-41-19 41-8" /><ellipse cx="130" cy="85" rx="11" ry="8" fill="currentColor" opacity=".8" /><ellipse cx="171" cy="77" rx="11" ry="8" fill="currentColor" opacity=".8" /><path d="m111 112 8-5m43 3 10 5m-72-73 3-8m87 62 8 3" />
    </g>}
    <path d="m51 51 3-7 3 7 7 3-7 3-3 7-3-7-7-3Z" fill="currentColor" opacity=".4" />
  </svg>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>('button, input, textarea, [tabindex="0"]')];
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={e => e.stopPropagation()}><div className="section-heading"><h2>{title}</h2><button className="text-button" onClick={onClose} aria-label="閉じる">✕</button></div>{children}</div></div>;
}

function StatList({ stats }: { stats: Stats }) {
  return <div className="stat-list">{STAT_KEYS.map(key => <div className={`stat ${key === 'money' ? 'stat-money' : ''}`} key={key}>
    <div className="stat-heading"><span>{STAT_LABELS[key]}</span><strong>{stats[key]}<small>{key === 'money' ? ' 点' : ' / 100'}</small></strong></div>
    {key !== 'money' && <div className="stat-track"><div className="stat-fill" style={{ width: `${stats[key]}%` }} /></div>}
  </div>)}</div>;
}

function Stages({ game }: { game: Game }) {
  const progress = getProgress(game);
  return <section className="stages-section" aria-label="夢の進み具合"><div className="section-heading"><div><span className="eyebrow">夢への道しるべ</span><h2>夢までの、3つのステップ</h2></div><span className="pill">{progress.percent}% 達成 · {progress.completedStages}/3 ステージ</span></div>
    <div className="stage-grid">{progress.stages.map((stage, i) => <article className={`stage-card ${stage.completed ? 'complete' : ''}`} key={stage.id}><div className="section-heading"><span className="eyebrow">ステップ 0{i + 1}</span><span className="hint">{stage.done}/{stage.total}</span></div><h3>{stage.title}</h3><ul className="task-list">{stage.tasks.map(task => <li className={`task-row ${task.completed ? 'complete' : ''}`} key={task.id}><span className="task-check" aria-label={task.completed ? '完了' : '未完了'}>{task.completed ? '✓' : '○'}</span>{task.label}</li>)}</ul></article>)}</div><p className="hint">各ステージの重みは同じです。達成した課題は、その後の数値が変わっても記録に残ります。</p>
  </section>;
}

function History({ game }: { game: Game }) {
  if (!game.history.length) return null;
  return <section className="panel"><div className="section-heading"><h2>これまでの歩み</h2><span className="hint">{game.history.length} ラウンドの記録</span></div><div className="history-list">{game.history.map(record => <details className="history-entry" key={record.round}><summary><span className="history-round">第{record.round}回</span><span>{record.actionLabels.join('・')}</span><span aria-hidden="true">＋</span></summary><div className="history-actions"><p>できごと：{record.eventTitle}</p>{record.choiceLabel && <p>大切にした方針：{record.choiceLabel}</p>}<p>{STAT_KEYS.map(k => `${STAT_LABELS[k]} ${delta(record.after[k] - record.before[k])}`).join(' / ')}</p><p className="reaction">「{record.reaction}」</p></div></details>)}</div></section>;
}

function Comparison({ results }: { results: Game[] }) {
  const [dreamFilter, setDreamFilter] = useState('all');
  const filtered = results.filter(g => dreamFilter === 'all' || g.dreamId === dreamFilter);
  return <section className="panel"><div className="section-heading"><div><span className="eyebrow">このブラウザーの記録</span><h2>みんなの記録を、次のヒントに。</h2></div><span className="pill">このブラウザーに {results.length} 件</span></div>
    <p>夢によって条件が異なるため、数値は話し合いの参考として比較してください。</p><p className="hint">この端末・このブラウザーに保存したグループの結果だけを表示します。別の端末とは同期されません。順位や総合点はつけません。</p>
    <label className="field" style={{ maxWidth: 320 }}><span className="field-label">夢で絞り込む</span><select value={dreamFilter} onChange={e => setDreamFilter(e.target.value)}><option value="all">すべての夢（保存順）</option>{DREAMS.map(d => <option value={d.id} key={d.id}>{d.title}</option>)}</select></label>
    {!filtered.length ? <div className="empty-state"><span>✳</span><h3>ここから、みんなの物語が始まります。</h3><p>ゲームが終わると、この場所にグループの記録が残ります。</p></div> : <><div className="table-scroll"><table className="comparison-table"><thead><tr>{['グループ', '夢 / 主人公', '進み具合', '心身の状態', '満足度', '残り資金'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map(g => <tr key={g.id}><th scope="row">{g.groupName}<small>{g.players}人 · {g.round}ラウンド</small></th><td>{getDream(g).title}<small>{getDream(g).character.name}</small></td><td>{getProgress(g).percent}%<small>{getProgress(g).completedStages}/3 ステージ</small></td><td>{g.stats.health}/100</td><td>{g.stats.satisfaction}/100</td><td>{g.stats.money} 点</td></tr>)}</tbody></table></div><div className="history-list">{filtered.map(g => <details className="history-entry" key={g.id}><summary>{g.groupName} の振り返りを読む <span>＋</span></summary><div className="history-actions"><p>{getEnding(g).title}</p>{REFLECTION_QUESTIONS.map((q, i) => <div key={q}><strong>{q}</strong><p>{g.reflections[i] || '未記入'}</p></div>)}<History game={g} /></div></details>)}</div></>}
  </section>;
}

export default function App() {
  const [initial] = useState(loadSaved);
  const [saved, setSaved] = useState(initial.data);
  const [warning, setWarning] = useState(initial.warning);
  const [isSaved, setIsSaved] = useState(true);
  const [view, setView] = useState<'game' | 'compare'>('game');
  const [modal, setModal] = useState<'rules' | 'restart' | 'clear' | null>(null);
  const [groupName, setGroupName] = useState('');
  const [players, setPlayers] = useState<5 | 6>(6);
  const [dreamId, setDreamId] = useState<DreamId>('cafe');
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const game = saved.current;
  useEffect(() => { const success = saveData(saved); setIsSaved(success); if (!success) setWarning('このブラウザーでは保存できません。今の画面では遊べますが、更新すると進捗が失われます。'); }, [saved]);
  function updateGame(fn: (g: Game) => Game) {
    setSaved(previous => {
      if (!previous.current) return previous;
      const current = fn(previous.current);
      return { ...previous, current, results: current.status === 'finished' ? upsertResult(previous.results, current) : previous.results };
    });
  }
  function begin() {
    if (!groupName.trim()) return;
    const current = { ...createGame(groupName.trim(), players, dreamId), roleAssignments };
    setSaved(previous => ({ ...previous, current }));
    window.scrollTo({ top: 0 });
  }
  function reset() { setSaved(previous => ({ ...previous, current: null })); setView('game'); setModal(null); window.scrollTo({ top: 0 }); }
  const dream = game ? getDream(game) : DREAMS.find(d => d.id === dreamId)!;
  const roles = (count: number) => ROLES.filter((_, index) => count !== 5 || index !== 5).map((r, index) => count === 5 && index === 0 ? { ...r, label: '計画・本人の意思担当', prompt: `${r.prompt} ${ROLES[5].prompt}` } : r);

  return <div className="app-shell"><header className="site-header"><button className="brand" onClick={() => setView('game')} aria-label="夢のサポーターズ ホーム"><span className="brand-mark">✳</span><span className="brand-copy"><strong>夢のサポーターズ</strong><small>みんなで、夢のその先へ。</small></span></button><nav className="header-actions" aria-label="メインメニュー"><button className="text-button" onClick={() => setModal('rules')}>遊び方</button><button className="text-button" onClick={() => setView(view === 'compare' ? 'game' : 'compare')}>{view === 'compare' ? 'ゲームに戻る' : 'みんなの記録'} <span className="record-count">{saved.results.length}</span></button>{game && <button className="text-button" onClick={() => setModal('restart')}>新しく始める</button>}</nav></header>
    {warning && <p className="notice" role="status">{warning}</p>}
    <main>{view === 'compare' ? <div className="comparison-page"><div className="hero"><div><span className="eyebrow">夢のかたちは、ひとつずつ違う</span><h1>それぞれの夢、それぞれの歩み。</h1></div></div><Comparison results={saved.results} /><button className="button secondary" onClick={() => setView('game')}>ゲームに戻る</button></div> : !game ? <>
      <section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="tiny-dot" /> 話し合いから生まれる、協力シミュレーション</span><h1 className="hero-title">誰かの夢を、<br /><em>みんなの一歩に。</em></h1><p className="hero-description">あなたは、夢を応援するサポーター。<br />限られた時間と資金を分かち合い、本人らしい未来を一緒につくろう。</p><div className="hero-facts"><span>♧ 5〜6人で協力</span><span>◷ 約15〜25分</span><span>↻ 全6ラウンド</span></div></div><div className="hero-aside"><span className="hero-orbit">✳</span><p>ひとりの夢に、<br />いくつもの力を。</p><small>聴く · 考える · 支える</small></div></section>
      <div className="steps" aria-label="はじめる準備"><span className="step active"><b>01</b> 夢を選ぶ</span><span className="step"><b>02</b> チームをつくる</span><span className="step"><b>03</b> 一歩を踏み出す</span></div>
      <section><div className="section-heading"><div><span className="eyebrow">応援する夢を選ぶ</span><h2>どの夢の、サポーターになりますか？</h2></div><span className="hint">3つの物語からひとつ選ぼう</span></div><div className="dream-grid">{DREAMS.map((d, index) => <button type="button" className={`dream-card ${dreamId === d.id ? 'selected' : ''}`} onClick={() => setDreamId(d.id)} aria-pressed={dreamId === d.id} key={d.id} style={{ '--dream-bg': DREAM_COLORS[d.id][0], '--dream-color': DREAM_COLORS[d.id][1] } as CSSProperties}><div className="dream-art"><span className="dream-type">物語 0{index + 1}</span><DreamArt id={d.id} /><span className="selection-mark">{dreamId === d.id ? '✓' : '↗'}</span></div><div className="dream-card-body"><p className="dream-person">{d.character.name} の夢</p><h3 className="dream-title">{d.title}</h3><p className="dream-description">{d.character.motivation}</p></div></button>)}</div></section>
      <div className="setup-grid"><section className="panel character-details"><div className="section-heading"><div><span className="eyebrow">主人公のことを知ろう</span><h2>{dream.character.name} を知ろう</h2></div><span className="avatar">{dream.icon}</span></div><p>{dream.character.background}</p><blockquote className="character-quote">「{dream.character.quote}」</blockquote><div className="detail-columns"><div className="detail-block"><h3>大切にしていること</h3><p>{dream.character.values}</p></div><div className="detail-block"><h3>本人が望まないこと</h3><p>{dream.character.refusal}</p></div><div className="detail-block"><h3>今ある力</h3><p>{dream.character.strength}</p></div><div className="detail-block"><h3>これからの課題</h3><p>{dream.character.difficulty}</p></div></div><details className="goal-details"><summary>3つのステップと、夢の達成条件を見る</summary>{dream.stages.map((s, i) => <div key={s.id}><h4>{i + 1}. {s.title}</h4><ul>{s.tasks.map(t => <li key={t.id}>{t.label}</li>)}</ul></div>)}<p className="hint">最終実行が完了すると夢を達成します。心身50以上・満足度60以上が、無理なく続けられる目安です。</p></details></section>
      <section className="panel setup-panel"><span className="eyebrow">あなたたちのチーム</span><h2>まずは、チームの準備から。</h2><label className="field"><span className="field-label">グループ名 <span className="hint">必須</span></span><input value={groupName} onChange={e => setGroupName(e.target.value)} maxLength={40} placeholder="例：木もれびチーム" autoComplete="off" /></label><div className="field"><span className="field-label" id="players-label">参加人数</span><div className="segmented" role="group" aria-labelledby="players-label">{([5, 6] as const).map(n => <button className={players === n ? 'selected' : ''} aria-pressed={players === n} onClick={() => setPlayers(n)} key={n}>{n}人</button>)}</div><p className="hint">5人のときは、計画担当と本人の意思担当を兼任します。</p></div><div className="setup-tip"><span>☏</span><p>ひとつの画面を囲んで相談します。操作する人を1人決めておきましょう。</p></div></section></div>
      <section className="panel"><div className="section-heading"><div><span className="eyebrow">一人ひとりに、支援の視点を</span><h2>みんなの視点を、持ち寄ろう。</h2></div><span className="hint">担当を決めてからスタート · 名前は任意</span></div><div className="role-grid">{roles(players).map((role, i) => <label className="role-card" key={role.id}><span className="role-number">0{i + 1}</span><strong>{role.label}</strong><p>{role.prompt}</p><input aria-label={`${role.label}の名前`} placeholder="担当する人の名前（任意）" maxLength={24} value={roleAssignments[role.id] || ''} onChange={e => setRoleAssignments({ ...roleAssignments, [role.id]: e.target.value })} /></label>)}</div></section>
      <div className="setup-footer"><div><strong>正解は、ひとつじゃない。</strong><p className="hint">本人の声を聴きながら、6ラウンドの物語を始めましょう。</p>{!groupName.trim() && <p className="hint">グループ名を入力すると始められます。</p>}</div><button className="button primary" disabled={!groupName.trim()} onClick={begin}>このチームで、夢を応援する <span>→</span></button></div>
    </> : game.status === 'finished' ? <>
      <section className="results-hero"><span className="eyebrow">あなたたちが紡いだ物語</span><div className="ending-icon">✳</div><span className="pill">{game.groupName} · {game.round}ラウンドの歩み</span><h1>{getEnding(game).title}</h1><p>{getEnding(game).description}</p><p>{dream.character.name} の「{dream.title}」</p></section>
      <div className="metric-grid"><div className="metric-card"><span>夢の進み具合</span><strong>{getProgress(game).percent}<small>%</small></strong><p>{getProgress(game).completedStages} / 3 ステージ完了</p></div>{STAT_KEYS.map(k => <div className="metric-card" key={k}><span>{STAT_LABELS[k]}</span><strong>{game.stats[k]}<small>{k === 'money' ? '点' : '/100'}</small></strong></div>)}</div>
      <div className="panel"><h2>今回の支援を振り返ると</h2><ul className="feedback-list">{getEnding(game).feedback.map(f => <li key={f}>{f}</li>)}</ul><p className="hint">心身50以上・満足度60以上が持続可能性の目安です。結果は次の支援を考える手がかりです。</p></div><Stages game={game} /><History game={game} />
      <section className="panel"><div className="section-heading"><div><span className="eyebrow">みんなで振り返る</span><h2>最後に、みんなで話してみよう。</h2></div><span className="pill">記入は任意 · 自動保存</span></div><div className="reflection-grid">{REFLECTION_QUESTIONS.map((q, i) => <label className="reflection-field" key={q}><span><b>0{i + 1}</b> {q}</span><textarea rows={3} maxLength={1000} value={game.reflections[i] || ''} onChange={e => { const value = e.target.value; updateGame(g => ({ ...g, reflections: REFLECTION_QUESTIONS.map((_, j) => j === i ? value : g.reflections[j] || '') })); }} placeholder="話し合ったことを、ひとこと残そう。" /></label>)}</div></section>
      <div className="setup-footer"><p className="hint" role="status">{isSaved ? '✓ このグループの結果と振り返りを、このブラウザーに保存しています。' : '保存できていません。この画面を閉じると記録が失われます。'}</p><div className="header-actions"><button className="button secondary" onClick={() => setView('compare')}>みんなの記録を見る</button><button className="button primary" onClick={() => setModal('restart')}>別の夢にも挑戦する →</button></div></div><Comparison results={saved.results} />
    </> : <>
      <section className="game-topbar"><div><span className="eyebrow">{game.groupName} · {game.players}人のサポーター</span><h1>{dream.title}</h1><p>{dream.character.name} と歩む、夢への道。</p></div><div className="round-indicator"><span>ラウンド <strong>{game.round}</strong> / {RULES.rounds}</span><div className="round-dots">{Array.from({ length: RULES.rounds }, (_, i) => <span className={`round-dot ${i + 1 < game.round ? 'done' : i + 1 === game.round ? 'active' : ''}`} key={i} />)}</div></div></section>
      <div className="game-layout"><aside className="sidebar"><section className="panel"><div className="character-mini"><span className="avatar">{dream.icon}</span><div><span className="eyebrow">あなたが支える主人公</span><h2>{dream.character.name}</h2></div></div><p className="character-quote">「{dream.character.quote}」</p><StatList stats={game.stats} /><div className="values-note"><h3>大切にしたいこと</h3><p>{dream.character.values}</p><h3>本人が望まないこと</h3><p>{dream.character.refusal}</p><small>本人が明確に断る方法は、行動に含まれません。</small></div><details className="goal-details"><summary>人物の背景を読む</summary><p>{dream.character.background}</p><p>{dream.character.motivation}</p><p>{dream.character.difficulty}</p></details></section><section className="panel"><h3>ひとりずつ、声を出そう。</h3><div className="discussion-prompts">{roles(game.players).map(r => <p key={r.id}><strong>{r.label}{game.roleAssignments?.[r.id] ? ` · ${game.roleAssignments[r.id]}` : ''}</strong><small>{r.prompt}</small></p>)}</div></section></aside>
      <div className="main-column"><section className="event-card"><span className="event-label">✧ ラウンド {game.round} · 今回のできごと</span><h2 className="event-title">{getEvent(game).title}</h2><p className="event-description">{getEvent(game).description}</p></section>
      {game.status === 'result' ? <section className="panel result-banner" aria-live="polite"><span className="eyebrow">一緒に進めた、一歩</span><h2>このラウンドの支援が届きました。</h2><p>{game.history.at(-1)?.actionLabels.join('・')}</p><blockquote className="reaction">「{game.history.at(-1)?.reaction}」</blockquote><div className="preview-grid">{STAT_KEYS.map(k => { const r = game.history.at(-1)!; const d = r.after[k] - r.before[k]; return <div className="preview-stat" key={k}><span>{STAT_LABELS[k]}</span><strong>{r.after[k]} <small className={`delta ${d > 0 ? 'positive' : d < 0 ? 'negative' : ''}`}>{delta(d)}</small></strong></div>; })}</div><p>{game.history.at(-1)?.newTaskIds.length ? `${game.history.at(-1)!.newTaskIds.length}つの課題を、新しく達成しました。` : '今回の記録をもとに、次の支援を相談しましょう。'}</p><div className="turn-actions"><button className="button primary" onClick={() => { updateGame(nextRound); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{game.round === RULES.rounds ? '結果と振り返りを見る →' : '次のラウンドへ →'}</button>{isGoalComplete(game) && game.round < RULES.rounds && <button className="button secondary" onClick={() => updateGame(finishGame)}>夢を達成したので、ここで振り返る</button>}</div>{isGoalComplete(game) && game.round < RULES.rounds && <p className="hint">夢を達成しました！ 第6ラウンドまで続けて、心身や満足度を整えることもできます。</p>}</section> : <>
        {game.round === RULES.choiceRound && <section className="panel"><span className="eyebrow">本人の声を聴いてみよう</span><h2>本人と一緒に、方針を選ぼう。</h2><p className="hint">今回はどちらか1つを選びます。費用・時間・効果も今の計画に含まれます。</p><div className="choice-grid">{dream.strategies.map(s => <button className={`choice-button ${game.choiceId === s.id ? 'selected' : ''}`} key={s.id} aria-pressed={game.choiceId === s.id} onClick={() => updateGame(g => chooseStrategy(g, s.id))}><strong>{s.title}</strong><p>{s.description}</p><p className="hint">本人の声：{s.attitude}</p><span className="cost">時間 {s.time} · {moneyLabel(s.cost)}</span><p className="action-effects">{STAT_KEYS.filter(k => s.effects[k]).map(k => `${STAT_LABELS[k]} ${delta(s.effects[k]!)}`).join(' · ')}</p></button>)}</div></section>}
        <div className="section-heading"><div><span className="eyebrow">次の一歩を考えよう</span><h2>今、どんな支援をしよう？</h2></div><span className="pill">{game.selectedActionIds.length} / 3 選択中</span></div><p className="hint">選ぶだけでは実行されません。条件はラウンド開始時に判定し、実行時にまとめて精算します。</p><div className="action-grid">{getActions(game).map(action => {
          const selected = game.selectedActionIds.includes(action.id);
          const full = !selected && game.selectedActionIds.length >= RULES.maxActions;
          const reasons = !action.available ? action.reasons : full ? ['選べる行動は3つまでです。ほかの行動を外してください。'] : [];
          const requirements = [...Object.entries(action.requirements?.minStats || {}).map(([k, value]) => `${STAT_LABELS[k as keyof Stats]} ${value}以上`), ...(action.requirements?.actions || []).map(id => `${dream.actions.find(a => a.id === id)?.label || id}を完了`)];
          return <button key={action.id} className={`action-card ${selected ? 'selected' : ''} ${!action.available ? 'unavailable' : ''}`} disabled={!action.available || full} aria-pressed={selected} onClick={() => updateGame(g => toggleAction(g, action.id))}><div className="action-topline"><span className="action-icon">{ACTION_ICONS[action.id] || (action.category === 'dream' ? '✧' : '○')}</span><span className="hint">{action.category === 'dream' ? '夢のための支援' : '日々の支援'}{action.once ? ' · 1回限り' : ''}</span><span className="selection-mark">{selected ? '✓' : '＋'}</span></div><h3 className="action-title">{action.label}</h3><p className="action-description">{action.description}</p><div className="action-costs"><span className="cost">◷ 時間 {action.time}</span><span className="cost">{moneyLabel(action.cost)}</span></div><p className="action-effects">{STAT_KEYS.filter(k => k !== 'money' && action.effects[k]).map(k => `${STAT_LABELS[k]} ${delta(action.effects[k]!)}`).join(' · ') || (action.id === 'reflect' ? '数値の変化なし · 振り返りを記録' : '数値の変化なし · 準備課題の完了を記録')}</p>{requirements.length > 0 && <p className="action-requirements">条件：{requirements.join(' / ')}</p>}{reasons.length > 0 && <p className="action-requirements">{reasons.join(' ')}</p>}</button>;
        })}</div>
      </>}</div><aside className="plan-column"><Plan game={game} onExecute={() => updateGame(executePlan)} onRemove={id => updateGame(g => toggleAction(g, id))} /></aside></div><Stages game={game} /><History game={game} />
    </>}</main><footer className="footer"><span>✳ 夢のサポーターズ</span><p>競うより、支え合う。本人らしい夢のかたちを、一緒に。</p><button className="text-button" onClick={() => setModal('clear')}>この端末の記録を消去</button></footer>
    {modal === 'rules' && <Modal title="遊び方" onClose={() => setModal(null)}><ol className="rules-list"><li><strong>5〜6人で役割を分担。</strong>主人公の希望を読み、ひとりずつ意見を出します。</li><li><strong>毎回、最大3つの行動を選ぶ。</strong>時間は6点。余った時間は次に持ち越せません。資金は持ち越せます。</li><li><strong>見通しを確かめて実行。</strong>行動の前提はラウンド開始時の状態で判定します。今選んだ学習で、同じ回の新しい行動は解放されません。費用と効果はまとめて精算し、選択順による違いはありません。</li><li><strong>第3ラウンドは、本人と方針を選ぶ。</strong>時間や効果は行動と合計します。本人が拒む方法は選べません。</li><li><strong>全6ラウンドで振り返り。</strong>夢を早く達成したら終了も、継続も選べます。進み具合は3ステージの課題から等しく計算します。</li><li><strong>無理のない歩みも大切に。</strong>資金がなくても相談・休息・振り返りを選べます。心身50以上・満足度60以上が、続けられる状態の目安です。</li></ol><p className="hint">現在のゲームと終了した結果は、このブラウザーに自動保存します。別の端末とは同期しません。</p><button className="button primary" onClick={() => setModal(null)}>わかりました</button></Modal>}
    {modal === 'restart' && <Modal title="新しいチームで始めますか？" onClose={() => setModal(null)}><p>進行中のゲームは最初に戻ります。終了して保存したグループの結果は残ります。</p><div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>戻る</button><button className="button primary" onClick={reset}>新しく始める</button></div></Modal>}
    {modal === 'clear' && <Modal title="この端末の記録をすべて消しますか？" onClose={() => setModal(null)}><p>現在のゲーム、終了したグループの結果、振り返りの記入内容が消えます。この操作は取り消せません。</p><div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>消去せずに戻る</button><button className="button danger" onClick={() => { if (removeData()) { setSaved(emptySave()); setWarning(''); setView('game'); setModal(null); } else { setWarning('記録を消去できませんでした。ブラウザーの保存設定を確認してください。'); setModal(null); } }}>すべての記録を消去する</button></div></Modal>}
  </div>;
}

function Plan({ game, onExecute, onRemove }: { game: Game; onExecute: () => void; onRemove: (id: string) => void }) {
  const plan = previewPlan(game), dream: Dream = getDream(game);
  if (game.status !== 'planning') return <section className="panel plan-panel"><span className="eyebrow">このラウンドは実行済み</span><h2>支援を実行しました。</h2><p>今の数値は実行後の状態です。振り返ってから、次へ進みましょう。</p><div className="values-note"><strong>次に考えたいこと</strong><p>{getProgress(game).stages.find(s => !s.completed)?.title || '夢のその先も、無理のないペースで。'}</p></div></section>;
  return <section className="panel plan-panel"><div className="section-heading"><h2>今回の支援プラン</h2><span className="hint">{game.selectedActionIds.length}/3</span></div><div className="selection-list">{!plan.actions.length ? <p className="empty-plan">行動を選ぶと、ここに<br />プランがまとまります。</p> : plan.actions.map(a => <div className="selection-row" key={a.id}><span>{a.label}<small>時間 {a.time} · {moneyLabel(a.cost)}</small></span><button className="text-button" aria-label={`${a.label}を外す`} onClick={() => onRemove(a.id)}>✕</button></div>)}</div>{plan.strategy && <div className="notice"><small>本人と決めた方針</small><p>{plan.strategy.title}</p><small>時間 {plan.strategy.time} · {moneyLabel(plan.strategy.cost)}</small></div>}
    <div className="budget"><div className="budget-row"><span>使う時間</span><strong className={plan.timeUsed > 6 ? 'negative' : ''}>{plan.timeUsed} / 6</strong></div><div className="budget-track"><div className={`budget-fill ${plan.timeUsed > 6 ? 'over' : ''}`} style={{ width: `${Math.min(100, plan.timeUsed / 6 * 100)}%` }} /></div><div className="budget-row"><span>資金の増減</span><strong className={plan.moneyCost > game.stats.money ? 'negative' : ''}>{delta(-plan.moneyCost)} 点</strong></div></div>
    <h3>実行後の見通し</h3><div className="preview-grid">{STAT_KEYS.map(k => { const d = plan.stats[k] - game.stats[k]; return <div className="preview-stat" key={k}><span>{STAT_LABELS[k]}</span><strong>{plan.stats[k]}<small className={`delta ${d > 0 ? 'positive' : d < 0 ? 'negative' : ''}`}> {delta(d)}</small></strong></div>; })}</div>
    {!plan.valid && <div className="validation-message" role="status">{plan.reasons.map(r => <p key={r}>{r}</p>)}</div>}<button className="button primary" disabled={!plan.valid} onClick={onExecute}>この計画を実行する <span>→</span></button><p className="hint">実行すると取り消せません。全員の意見と、{dream.character.name} の気持ちを確かめよう。</p><div className="values-note"><strong>次のステップ</strong><p>{getProgress(game).stages.find(s => !s.completed)?.title || '夢の達成後も、心身のケアを続けよう。'}</p></div>
  </section>;
}
