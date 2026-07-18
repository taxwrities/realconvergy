/* ================================================================
   numbers — sieve to 100k (O(1) prime/composite index + nth),
   9s chains. Locks: nthPrime(12)=37, nthPrime(8)=19,
   nthComposite(8)=15, primeIndex(61)=18.
================================================================ */
const SIEVE_N=100000;
const _comp=new Uint8Array(SIEVE_N+1);
for(let i=2;i*i<=SIEVE_N;i++)if(!_comp[i])for(let j=i*i;j<=SIEVE_N;j+=i)_comp[j]=1;
const _pc=new Int32Array(SIEVE_N+1),_cc=new Int32Array(SIEVE_N+1);
const _plist=[0],_clist=[0];
for(let i=2;i<=SIEVE_N;i++){
  const pr=!_comp[i];
  _pc[i]=_pc[i-1]+(pr?1:0);_cc[i]=_cc[i-1]+((i>=4&&_comp[i])?1:0);
  if(pr)_plist.push(i);else if(i>=4)_clist.push(i);
}
export function isPrime(n){return n>=2&&n<=SIEVE_N&&!_comp[n]}
export function primeIndex(n){return isPrime(n)?_pc[n]:-1}
export function compositeIndex(n){return(n>=4&&n<=SIEVE_N&&_comp[n])?_cc[n]:-1}
export function nthPrime(n){return _plist[n]||0}
export function nthComposite(n){return _clist[n]||0}

/* Spelled cardinals for the numberWord pattern source — uppercase, no
   hyphens, no AND (Zach convention: 8→EIGHT=31 Red, 57→FIFTY SEVEN).
   Range 0..9999; outside → '' so a condition just resolves empty. */
const ONES=['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN',
  'ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
const TENS=['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
export function numberToWords(n){
  n=Math.floor(+n);
  if(!Number.isFinite(n)||n<0||n>9999)return'';
  if(n===0)return'ZERO';
  const small=k=>{
    let s='';
    if(k>=100){s+=ONES[Math.floor(k/100)]+' HUNDRED';k%=100;if(k)s+=' '}
    if(k>=20){s+=TENS[Math.floor(k/10)];if(k%10)s+=' '+ONES[k%10]}
    else if(k)s+=ONES[k];
    return s;
  };
  let s='';
  if(n>=1000){s+=ONES[Math.floor(n/1000)]+' THOUSAND';n%=1000;if(n)s+=' '}
  return s+small(n);
}

/* 9s chains: every number belongs to the chain of its value mod 9
   (base 1..9, using 9 for multiples of 9). chainBase(6)=6, members
   6,15,24,33… The scanner's badge chain is chainBase 6. */
export function chainBase(n){const r=n%9;return r===0?9:r}
export function sameChain(a,b){return chainBase(a)===chainBase(b)}
export function chainMembers(n,count=8){
  const base=chainBase(n);
  return Array.from({length:count},(_,i)=>base+9*i);
}
