/* 管理ページ共通の認証。admin*.html から読む。
 *
 * ⚠ 以前は access_token だけを sessionStorage に持っていたため、Supabase の
 *   アクセストークンが切れた時点（既定1時間）で操作が止まり、そのたびに
 *   ログインし直す必要があった。refresh_token を持って自動で更新する。
 *
 * ・401/403 が返ったら 1回だけトークンを更新して、同じリクエストをやり直す
 * ・Supabase の refresh_token は使うたびに新しくなるので、必ず保存し直す
 * ・保存先は sessionStorage のまま（タブを閉じれば消える）。管理ページは
 *   モデレーション待ちの投稿＝他人の書いた文字列を描画するので、
 *   localStorage に長期保存はしない。
 */
(function (global) {
  "use strict";

  var SUPABASE = "https://djgafiowdldqtearqtdd.supabase.co";
  var ANON = "sb_publishable_sPdzya_DNqn3uTglBjvn7w_tKugUATk";
  var K_ACCESS = "jm_admin_token";
  var K_REFRESH = "jm_admin_refresh";

  function getAccess() { return sessionStorage.getItem(K_ACCESS) || ""; }
  function getRefresh() { return sessionStorage.getItem(K_REFRESH) || ""; }

  function save(d) {
    if (d && d.access_token) sessionStorage.setItem(K_ACCESS, d.access_token);
    // ⚠ 更新のたびに新しい refresh_token が返る。上書きしないと次回が失敗する。
    if (d && d.refresh_token) sessionStorage.setItem(K_REFRESH, d.refresh_token);
  }

  function clear() {
    sessionStorage.removeItem(K_ACCESS);
    sessionStorage.removeItem(K_REFRESH);
  }

  /* メール＋パスワードでログイン。成功で true、失敗はメッセージを投げる。 */
  async function login(email, password) {
    var r = await fetch(SUPABASE + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": ANON },
      body: JSON.stringify({ email: email, password: password }),
    });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok || !d.access_token) {
      throw new Error(d.error_description || d.msg || String(r.status));
    }
    save(d);
    return true;
  }

  /* refresh_token でアクセストークンを更新する。できなければ false。 */
  async function refresh() {
    var rt = getRefresh();
    if (!rt) return false;
    try {
      var r = await fetch(SUPABASE + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON },
        body: JSON.stringify({ refresh_token: rt }),
      });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok || !d.access_token) { clear(); return false; }
      save(d);
      return true;
    } catch (e) {
      return false;   // 通信エラーは消さない（オフラインで締め出さないため）
    }
  }

  /* admin 関数を呼ぶ。401/403 なら 1回だけ更新して やり直す。
     返り値は { ok, status, data }。表示は呼び出し側に任せる。 */
  async function request(action, params, _retried) {
    var body = Object.assign({ action: action }, params || {});
    var r = await fetch(SUPABASE + "/functions/v1/admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON,
        "Authorization": "Bearer " + getAccess(),
      },
      body: JSON.stringify(body),
    });
    if ((r.status === 401 || r.status === 403) && !_retried) {
      if (await refresh()) return request(action, params, true);
    }
    var d = await r.json().catch(function () { return {}; });
    return { ok: r.ok, status: r.status, data: d };
  }

  global.jmAdmin = {
    SUPABASE: SUPABASE,
    ANON: ANON,
    login: login,
    refresh: refresh,
    request: request,
    logout: clear,
    token: getAccess,
    hasSession: function () { return !!getAccess(); },
  };
})(window);
