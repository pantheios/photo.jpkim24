// 반응 목록 → 이모지별 개수 + 내가 누른 이모지
export function reactionSummary(
  reactions: { emoji: string; userId: string }[],
  userId: string,
): { counts: Record<string, number>; mine: string[] } {
  const counts: Record<string, number> = {};
  const mine: string[] = [];
  for (const r of reactions) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.userId === userId) mine.push(r.emoji);
  }
  return { counts, mine };
}

// 피드/상세에서 공통으로 쓰는 Prisma include
// 사진은 촬영시각순 (촬영시각이 없는 파일은 뒤로, 업로드 순서로 보조 정렬)
export const postInclude = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  media: {
    orderBy: [{ takenAt: { sort: "asc", nulls: "last" } }, { order: "asc" }],
  },
  reactions: { select: { emoji: true, userId: true } },
  _count: { select: { comments: true } },
} as const;
