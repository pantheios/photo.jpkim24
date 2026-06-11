// 아기 생일 기준 나이 라벨. 태어난 날을 "생후 1일"로 센다(한국식).
//  - 100일 이하: "생후 N일"
//  - 12개월 미만: "N개월"
//  - 그 이상: "N살" 또는 "N살 M개월"
const DAY_MS = 24 * 60 * 60 * 1000;

export function ageLabel(birth: Date, on: Date = new Date()): string {
  const b = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const o = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  const days = Math.floor((o.getTime() - b.getTime()) / DAY_MS);
  if (days < 0) return "출생 전";

  const dday = days + 1; // 태어난 날 = 1일
  if (dday <= 100) return `생후 ${dday}일`;

  let months = (o.getFullYear() - b.getFullYear()) * 12 + (o.getMonth() - b.getMonth());
  if (o.getDate() < b.getDate()) months -= 1;

  if (months < 12) return `${months}개월`;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths === 0 ? `${years}살` : `${years}살 ${remMonths}개월`;
}
