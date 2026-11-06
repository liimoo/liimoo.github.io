const county = region => region?.prefectureCode ?? region?.prefecture;
const municipality = region => Boolean(region && region.name !== region.prefecture);
export function validTeam(regions,indices) {
 return Array.isArray(indices)&&indices.length===3&&new Set(indices).size===3&&indices.every(i=>municipality(regions[i])&&county(regions[i])===county(regions[indices[0]]));
}
export function chooseCity(regions,indices,index) {
 const city=regions[index];
 if(!municipality(city))return [...indices];
 if(indices.includes(index))return indices.filter(i=>i!==index);
 if(indices.length&&county(regions[indices[0]])!==county(city))return [index];
 return indices.length<3?[...indices,index]:[...indices];
}
export function defaultTeam(regions,index) {
 const members=regions.map((r,i)=>i).filter(i=>municipality(regions[i])&&county(regions[i])===county(regions[index]));
 return (members.includes(index)?[index,...members.filter(i=>i!==index)]:members).slice(0,3);
}
const prefectureRegion = region => Boolean(region && region.kind==='県' && region.name===region.prefecture);
export function validPrefectureTeam(regions,indices) {
 return Array.isArray(indices)&&indices.length===3&&indices.every(i=>prefectureRegion(regions[i]))&&new Set(indices.map(i=>county(regions[i]))).size===3;
}
export function choosePrefecture(regions,indices,index) {
 if(!prefectureRegion(regions[index]))return [...indices];
 if(indices.includes(index))return indices.filter(i=>i!==index);
 if(indices.some(i=>county(regions[i])===county(regions[index])))return [...indices];
 return indices.length<3?[...indices,index]:[...indices];
}
