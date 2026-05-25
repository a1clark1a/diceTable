import { tipForId } from './glossary';

export function tipForKeep(token: string): string {
  const m = /^k(h|l)(\d+)$/.exec(token);
  if (!m) return tipForId('keep');
  const dir = m[1] === 'h' ? 'highest' : 'lowest';
  const n = m[2];
  return `${token}: keep the ${n} ${dir} dice from the pool.`;
}
