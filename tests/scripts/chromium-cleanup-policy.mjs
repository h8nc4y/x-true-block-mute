// Windows taskkill は指定 PID が終了済みの場合に exit 128 を返す。exit code
// だけを一般化して無視すると権限拒否や helper 異常まで隠し得るため、観測済みの
// no-process race を構成する終了証拠を全て満たした場合だけ benign とする。
const TASKKILL_NO_PROCESS_EXIT_CODE = 128;
const TASKKILL_PREFIXES = new Set(["taskkill", "taskkillFallback"]);
const REDACTED_STDERR_PATTERN = /^\[redacted:\d+ chars\]$/;

export function shouldAttemptTaskkillFallback(taskkillResult, childExitedAfterPrimary) {
  // primary helperが失敗してもchildが実終了済みなら、再利用された同じPIDを
  // fallbackが誤って狙う余地を作らない。childが残る場合だけ従来の再試行を保つ。
  const primaryFailed =
    taskkillResult?.status !== "ok" || taskkillResult?.helperExited !== true;
  return primaryFailed && childExitedAfterPrimary !== true;
}

export function isBenignTaskkillNoProcessRace(summary, prefix) {
  // 呼び出し側の typo で未知フィールドを undefined のまま許可しない。
  if (!summary || !TASKKILL_PREFIXES.has(prefix)) {
    return false;
  }

  // Browser.close と直接 child / profile の cleanup が完了していることを先に固定し、
  // process-tree fallback 自体が cleanup の唯一の失敗要因だった場合だけ評価する。
  if (
    summary.browserClose !== "ok" ||
    summary.treeTerminateAttempted !== true ||
    summary.childExited !== true ||
    summary.profileRemoved !== true
  ) {
    return false;
  }

  // primary の exit 128 は、fallback判断より前に直接childの実終了を観測した
  // 場合だけ許可する。fallbackが必要だった結果を後段の成功で遡及的にbenignへ
  // 変えると、未知のprimary失敗やPID再利用を隠すためfail-closedに拒否する。
  if (prefix === "taskkill" && summary.childExitedBeforeFallback !== true) {
    return false;
  }

  // helper は正常に spawn / exit し、OS の「対象 PID なし」だけを返していなければ
  // ならない。spawn・kill・post-spawn error や timeout は従来どおり fail-closed。
  return (
    summary[`${prefix}Status`] === "nonzero" &&
    summary[`${prefix}ExitCode`] === TASKKILL_NO_PROCESS_EXIT_CODE &&
    summary[`${prefix}ErrorCode`] === null &&
    summary[`${prefix}HelperSpawned`] === true &&
    summary[`${prefix}PostSpawnErrorCode`] === null &&
    summary[`${prefix}KillRetryAttempted`] === false &&
    summary[`${prefix}HelperExited`] === true &&
    REDACTED_STDERR_PATTERN.test(summary[`${prefix}StderrRedacted`])
  );
}
