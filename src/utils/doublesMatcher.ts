import { DoublesPlayer, DoublesMatch, DoublesRound, Gender } from '../types';

/**
 * ダブルス組合せ生成の公平性アルゴリズム
 * 1. 試合消化数が少ないプレイヤーを優先して選出
 * 2. 休憩回数が多いプレイヤーを優先して選出
 * 3. 過去にペアを組んだ回数（ペア重複）を最小化
 * 4. 過去に対戦した回数（対戦重複）を最小化
 * 5. 男女比率に応じた自然なペアリング（同性ペアまたはミックス）
 */

export interface MatcherOptions {
  courtCount: number;
  mode?: 'fair' | 'mix_priority' | 'random';
}

export function generateDoublesRound(
  roundNumber: number,
  allPlayers: DoublesPlayer[],
  options: MatcherOptions
): { matches: DoublesMatch[]; restingPlayers: DoublesPlayer[]; updatedPlayers: DoublesPlayer[] } {
  const { courtCount, mode = 'fair' } = options;

  // 1. 今回プレイ可能なプレイヤーを抽出
  // (途中退出者 left、欠席 absent、一時休憩中 isResting は除外)
  const activePlayers = allPlayers.filter(
    p => (p.status === 'joined' || p.status === 'late') && !p.isResting
  );

  const neededPlayerCount = courtCount * 4;

  if (activePlayers.length < 4) {
    throw new Error('試合を行うには最低4名のアクティブプレイヤーが必要です。');
  }

  // 実際に使用できるコート数を調整（人数が足りない場合はコート数を減らす）
  const actualCourtCount = Math.min(courtCount, Math.floor(activePlayers.length / 4));
  const playingCount = actualCourtCount * 4;

  // 2. プレイヤーの選出
  // 優先順位:
  // - 試合消化数 (matchCount) が少ない順
  // - 休憩回数 (restCount) が多い順
  // - ランダムシャッフルによる揺らぎ
  const sortedCandidates = [...activePlayers].sort((a, b) => {
    if (a.matchCount !== b.matchCount) {
      return a.matchCount - b.matchCount; // 少ない方が先
    }
    if (a.restCount !== b.restCount) {
      return b.restCount - a.restCount; // 休憩多い方が先
    }
    return Math.random() - 0.5;
  });

  const selectedToPlay = sortedCandidates.slice(0, playingCount);
  const selectedResting = [
    ...sortedCandidates.slice(playingCount),
    ...allPlayers.filter(p => p.isResting && (p.status === 'joined' || p.status === 'late'))
  ].filter(p => p.status === 'joined' || p.status === 'late');

  // 3. ペア編成と対戦組合せ
  // selectedToPlay (playingCount名) を actualCourtCount * 2 ペアに分割
  // ペア重複回数と対戦重複回数をスコアリングして最適な組合せを探索
  const matches = optimizeMatchesForRound(roundNumber, selectedToPlay, actualCourtCount, mode);

  // 4. プレイヤーの試合数・休憩数の更新（※履歴は試合終了時に確定するため、生成時点では追加しない）
  const updatedPlayers: DoublesPlayer[] = allPlayers.map(p => {
    const isPlaying = selectedToPlay.some(sp => sp.playerId === p.playerId);
    const isCurrentlyActive = (p.status === 'joined' || p.status === 'late');

    if (isPlaying) {
      return {
        ...p,
        matchCount: p.matchCount + 1,
      };
    } else if (isCurrentlyActive) {
      // 休憩扱い
      return {
        ...p,
        restCount: p.restCount + 1,
      };
    } else {
      return p;
    }
  });

  return {
    matches,
    restingPlayers: selectedResting,
    updatedPlayers,
  };
}

/**
 * 選出されたプレイヤー群から最適なコート対戦を生成
 */
function optimizeMatchesForRound(
  roundNumber: number,
  players: DoublesPlayer[],
  courtCount: number,
  mode: 'fair' | 'mix_priority' | 'random'
): DoublesMatch[] {
  if (courtCount === 0 || players.length < 4) return [];

  // シャッフルして複数回試行し、最も重複コストが低い組合せを採用
  let bestScore = Infinity;
  let bestMatches: DoublesMatch[] = [];

  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const candidateMatches: DoublesMatch[] = [];
    let currentScore = 0;

    for (let c = 0; c < courtCount; c++) {
      const courtPlayers = shuffled.slice(c * 4, (c + 1) * 4);
      if (courtPlayers.length < 4) break;

      // 4人 (p0, p1, p2, p3) のペアの組み方は3通り:
      // Pattern 1: (p0, p1) vs (p2, p3)
      // Pattern 2: (p0, p2) vs (p1, p3)
      // Pattern 3: (p0, p3) vs (p1, p2)
      const patterns = [
        { teamA: [courtPlayers[0], courtPlayers[1]] as [DoublesPlayer, DoublesPlayer], teamB: [courtPlayers[2], courtPlayers[3]] as [DoublesPlayer, DoublesPlayer] },
        { teamA: [courtPlayers[0], courtPlayers[2]] as [DoublesPlayer, DoublesPlayer], teamB: [courtPlayers[1], courtPlayers[3]] as [DoublesPlayer, DoublesPlayer] },
        { teamA: [courtPlayers[0], courtPlayers[3]] as [DoublesPlayer, DoublesPlayer], teamB: [courtPlayers[1], courtPlayers[2]] as [DoublesPlayer, DoublesPlayer] },
      ];

      // 各パターンの重複ペナルティを計算
      let bestPattern = patterns[0];
      let lowestPatternPenalty = Infinity;

      for (const pattern of patterns) {
        let penalty = 0;

        // ペア重複ペナルティ (重み: 100)
        penalty += countPairDuplication(pattern.teamA[0], pattern.teamA[1]) * 100;
        penalty += countPairDuplication(pattern.teamB[0], pattern.teamB[1]) * 100;

        // 対戦相手重複ペナルティ (重み: 20)
        for (const a of pattern.teamA) {
          for (const b of pattern.teamB) {
            penalty += countOpponentDuplication(a, b) * 20;
          }
        }

        // ミックス優先モードの場合のボーナス/ペナルティ
        if (mode === 'mix_priority') {
          const isMixedA = isMixedPair(pattern.teamA[0], pattern.teamA[1]);
          const isMixedB = isMixedPair(pattern.teamB[0], pattern.teamB[1]);
          if (!isMixedA) penalty += 15;
          if (!isMixedB) penalty += 15;
        }

        if (penalty < lowestPatternPenalty) {
          lowestPatternPenalty = penalty;
          bestPattern = pattern;
        }
      }

      currentScore += lowestPatternPenalty;
      candidateMatches.push({
        id: `m-r${roundNumber}-c${c + 1}-${Date.now()}-${attempt}`,
        roundNumber,
        courtNumber: c + 1,
        courtName: `第${c + 1}コート`,
        teamA: bestPattern.teamA,
        teamB: bestPattern.teamB,
        isCompleted: false,
      });
    }

    if (currentScore < bestScore) {
      bestScore = currentScore;
      bestMatches = candidateMatches;
      if (bestScore === 0) break; // 完全重複なしが見つかったら即終了
    }
  }

  return bestMatches;
}

function countPairDuplication(p1: DoublesPlayer, p2: DoublesPlayer): number {
  if (!p1.historyPairIds || !p2.historyPairIds) return 0;
  return p1.historyPairIds.filter(id => id === p2.memberId).length;
}

function countOpponentDuplication(p1: DoublesPlayer, p2: DoublesPlayer): number {
  if (!p1.historyOpponentIds || !p2.historyOpponentIds) return 0;
  return p1.historyOpponentIds.filter(id => id === p2.memberId).length;
}

function isMixedPair(p1: DoublesPlayer, p2: DoublesPlayer): boolean {
  return (p1.gender === 'male' && p2.gender === 'female') || (p1.gender === 'female' && p2.gender === 'male');
}

/**
 * 4名のプレイヤーから最適な2ペア(対戦)を最適化
 */
export function optimizeSingleCourtMatch(
  courtNumber: number,
  roundNumber: number,
  fourPlayers: DoublesPlayer[],
  mode: 'fair' | 'mix_priority' | 'random' = 'fair'
): DoublesMatch {
  if (fourPlayers.length !== 4) {
    throw new Error('1コートには4名のプレイヤーが必要です');
  }

  const patterns = [
    { teamA: [fourPlayers[0], fourPlayers[1]] as [DoublesPlayer, DoublesPlayer], teamB: [fourPlayers[2], fourPlayers[3]] as [DoublesPlayer, DoublesPlayer] },
    { teamA: [fourPlayers[0], fourPlayers[2]] as [DoublesPlayer, DoublesPlayer], teamB: [fourPlayers[1], fourPlayers[3]] as [DoublesPlayer, DoublesPlayer] },
    { teamA: [fourPlayers[0], fourPlayers[3]] as [DoublesPlayer, DoublesPlayer], teamB: [fourPlayers[1], fourPlayers[2]] as [DoublesPlayer, DoublesPlayer] },
  ];

  let bestPattern = patterns[0];
  let lowestPenalty = Infinity;

  for (const pattern of patterns) {
    let penalty = 0;
    penalty += countPairDuplication(pattern.teamA[0], pattern.teamA[1]) * 100;
    penalty += countPairDuplication(pattern.teamB[0], pattern.teamB[1]) * 100;

    for (const a of pattern.teamA) {
      for (const b of pattern.teamB) {
        penalty += countOpponentDuplication(a, b) * 20;
      }
    }

    if (mode === 'mix_priority') {
      const isMixedA = isMixedPair(pattern.teamA[0], pattern.teamA[1]);
      const isMixedB = isMixedPair(pattern.teamB[0], pattern.teamB[1]);
      if (!isMixedA) penalty += 15;
      if (!isMixedB) penalty += 15;
    }

    if (penalty < lowestPenalty) {
      lowestPenalty = penalty;
      bestPattern = pattern;
    }
  }

  return {
    id: `m-r${roundNumber}-c${courtNumber}-${Date.now()}`,
    roundNumber,
    courtNumber,
    courtName: `第${courtNumber}コート`,
    teamA: bestPattern.teamA,
    teamB: bestPattern.teamB,
    isCompleted: false,
  };
}

/**
 * 流し込み方式: 指定したコートが終了した際に、休憩中のプレイヤーから優先的に4名を選出して新しい対戦を生成する
 */
export function generateStreamMatchForCourt(
  courtNumber: number,
  roundNumber: number,
  allPlayers: DoublesPlayer[],
  currentMatches: DoublesMatch[],
  mode: 'fair' | 'mix_priority' | 'random' = 'fair'
): { nextMatch: DoublesMatch; updatedPlayers: DoublesPlayer[] } {
  // 現在他コートで試合中のプレイヤーIDを取得（終了した該当コートの選手は除く）
  const playingPlayerIds = new Set<string>();
  currentMatches.forEach(m => {
    if (m.courtNumber !== courtNumber && !m.isCompleted) {
      m.teamA.forEach(p => playingPlayerIds.add(p.playerId));
      m.teamB.forEach(p => playingPlayerIds.add(p.playerId));
    }
  });

  // 流し込み候補: 他コートでプレイしておらず、休憩・離脱フラグがないアクティブなプレイヤー
  const availableCandidates = allPlayers.filter(
    p => !playingPlayerIds.has(p.playerId) && (p.status === 'joined' || p.status === 'late') && !p.isResting
  );

  if (availableCandidates.length < 4) {
    throw new Error('流し込みを行うには、現在コートに出ていないプレイヤーが4名以上必要です。');
  }

  // 優先順位: 試合数が少ない順、休憩回数が多い順
  const sorted = [...availableCandidates].sort((a, b) => {
    if (a.matchCount !== b.matchCount) {
      return a.matchCount - b.matchCount;
    }
    if (a.restCount !== b.restCount) {
      return b.restCount - a.restCount;
    }
    return Math.random() - 0.5;
  });

  const selectedFour = sorted.slice(0, 4);
  const nextMatch = optimizeSingleCourtMatch(courtNumber, roundNumber, selectedFour, mode);

  // プレイヤーの試合数・休憩数を更新（※履歴は試合終了時に確定するため、生成時点では追加しない）
  const selectedIds = new Set(selectedFour.map(p => p.playerId));
  const updatedPlayers = allPlayers.map(p => {
    if (selectedIds.has(p.playerId)) {
      return {
        ...p,
        matchCount: p.matchCount + 1,
      };
    }
    return p;
  });

  return { nextMatch, updatedPlayers };
}
