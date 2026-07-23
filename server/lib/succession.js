// ==========================================================================
// 事業承継レディネス（簡易診断）
//
// 社長年齢・後継者の有無（任意項目）と、既存の財務指標（自己資本比率・
// 債務償還年数など）を組み合わせて、事業承継に向けた準備状況を簡易的に
// コメントする。ownerAge・successorStatus のどちらも未入力の場合は
// null を返し、診断画面には表示されない（任意機能）。
// ==========================================================================

function ageUrgency(ownerAge) {
  if (ownerAge === null || ownerAge === undefined) return null;
  if (ownerAge >= 70) return { level: 'high', text: '社長の年齢を踏まえると、承継準備は喫緊の課題と考えられます。' };
  if (ownerAge >= 60) return { level: 'mid', text: '承継準備を本格化させる時期に差し掛かっています。' };
  return { level: 'low', text: 'まだ時間的な余裕はありますが、早めに方向性を検討しておくと安心です。' };
}

function successorNote(successorStatus) {
  switch (successorStatus) {
    case '決定済み':
      return '後継者は決定済みとのことなので、権限移譲のスケジュールや株式・経営者保証の引き継ぎ方を具体化する段階です。';
    case '検討中':
      return '後継者候補との対話を深め、いつまでに決定するかの目線合わせを進めるとよいでしょう。';
    case '未定':
      return '後継者が未定の場合、親族内承継だけでなく、従業員承継やM&Aによる第三者承継も選択肢に入れて早めに検討することをお勧めします。';
    default:
      return null;
  }
}

function financialReadiness(equityRatio, debtServiceYears) {
  const notes = [];
  if (equityRatio !== null && equityRatio !== undefined) {
    if (equityRatio >= 40) {
      notes.push('自己資本比率は良好な水準で、財務面での承継のしやすさは高いといえます。');
    } else if (equityRatio < 20) {
      notes.push('自己資本比率がやや低く、承継前に財務体質の改善に取り組む余地があります。');
    }
  }
  if (debtServiceYears !== null && debtServiceYears !== undefined) {
    if (debtServiceYears <= 10) {
      notes.push('債務償還年数も良好で、経営者保証の解除を金融機関に相談しやすい状態です。');
    } else if (debtServiceYears > 15) {
      notes.push('債務償還年数が長めなので、経営者保証を引き継ぐ後継者の負担が大きくなる可能性があります。');
    }
  }
  return notes;
}

/**
 * @param {object} input
 * @param {number|null} input.ownerAge - 社長年齢
 * @param {string|null} input.successorStatus - '決定済み' | '検討中' | '未定' | null
 * @param {number|null} input.equityRatio
 * @param {number|null} input.debtServiceYears
 * @returns {{summary: string}|null}
 */
function computeSuccessionReadiness({ ownerAge, successorStatus, equityRatio, debtServiceYears }) {
  const hasProfileInput = (ownerAge !== null && ownerAge !== undefined) || (successorStatus !== null && successorStatus !== undefined && successorStatus !== '');
  if (!hasProfileInput) return null;

  const sentences = [];
  const urgency = ageUrgency(ownerAge);
  if (urgency) sentences.push(urgency.text);

  const successor = successorNote(successorStatus);
  if (successor) sentences.push(successor);

  const financial = financialReadiness(equityRatio, debtServiceYears);
  sentences.push(...financial);

  if (sentences.length === 0) {
    sentences.push('事業承継に関する追加情報が限られているため、簡易的な参考コメントのみとなります。');
  }
  sentences.push('本コメントは簡易的な参考情報です。実際の事業承継の検討には税理士・弁護士・事業承継の専門家への相談を推奨します。');

  return { summary: sentences.join('') };
}

module.exports = { computeSuccessionReadiness };
