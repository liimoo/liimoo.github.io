const URL_TO_PLAY='https://japan-map.app/blade/';
export function resultShare({mode,winner,player,cpu}) {
 const label=roster=>mode==='team'
  ?`${roster[0].prefecture}（${roster.map(r=>r.name).join('・')}）`
  :roster.map(r=>mode==='single'&&r.prefecture&&r.prefecture!==r.name?`${r.prefecture}${r.name}`:r.name).join('・');
 const modeLabel=mode==='team'?'都市対抗3vs3':mode==='pref-team'?'県対抗3vs3':'1vs1';
 const outcome=winner==='player'?'勝利！':winner==='cpu'?'敗北…再挑戦！':'引き分け！';
 const text=`${modeLabel}で${outcome}\n${label(player)} vs ${label(cpu)}\n地図の形がコマになる！ #都市ブレード`;
 const intent=new URL('https://x.com/intent/tweet');intent.searchParams.set('text',text);intent.searchParams.set('url',URL_TO_PLAY);
 return {title:'都市ブレード',text,url:URL_TO_PLAY,xUrl:intent.href,copyText:`${text}\n${URL_TO_PLAY}`};
}
