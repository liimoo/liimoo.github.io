const kana=new Intl.Collator('ja');
export function orderRegions(items,order='north'){
 const national=items.every(({region})=>region.kind==='県');
 return [...items].sort((a,b)=>{
  const x=a.region,y=b.region;
  if(!national&&(x.kind==='県')!==(y.kind==='県'))return x.kind==='県'?-1:1;
  const byName=kana.compare(x.reading||x.name,y.reading||y.name)||kana.compare(x.name,y.name);
  if(order==='kana')return byName;
  const ax=national?Number(x.prefectureCode):x.sortY,bx=national?Number(y.prefectureCode):y.sortY;
  if(Number.isFinite(ax)!==Number.isFinite(bx))return Number.isFinite(ax)?-1:1;
  return (Number.isFinite(ax)?(ax-bx)*(order==='south'?-1:1):0)||byName;
 });
}
