/* global api, projectUrl, loginFailed, loginError */
const safariBlocker = document.getElementById("safariBlocker");
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// 응답 본문을 읽기 전에 상태 코드를 봅니다. 4xx·5xx는 본문이 JSON이 아닐 수
// 있어(프록시가 낸 HTML 오류 페이지 등) 곧바로 json()을 부르면 파싱 오류가 나고,
// 실제 원인과 무관한 메시지가 사용자에게 노출됩니다.
function readJson(res) {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

// CSP를 걸기 위해 body의 oncontextmenu 속성에서 옮겨온 것입니다.
document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.addEventListener("DOMContentLoaded", () => {
  if (isSafari) {
    safariBlocker.classList.remove("hide");
  }

  fetch(`${api}/auth/status`, {
    method: "GET",
    credentials: "include",
  })
    .then(readJson)
    .then((data) => {
      if (data.status == "Logined") {
        window.location.href = `${projectUrl}/game`;
      } else if (data.status == "Not registered") {
        window.location.href = `${projectUrl}/join`;
      }
    })
    .catch((error) => {
      // 로그인 여부 확인 실패는 화면을 막지 않습니다. 로그인 버튼은 그대로
      // 쓸 수 있으므로 콘솔에만 남기고 사용자 흐름은 끊지 않습니다.
      console.error(error);
    });
});

// GSI 스크립트가 차단되거나 로드에 실패하면 버튼이 아예 그려지지 않습니다.
// 그대로 두면 아무 반응 없는 빈 화면으로 보이므로 원인을 알려줍니다.
// async 스크립트는 load 이벤트를 지연시키므로 이 시점이면 결과가 확정됩니다.
window.addEventListener("load", () => {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    console.error("Google Identity Services failed to load.");
    alert(loginError);
  }
});

// eslint-disable-next-line no-unused-vars
function handleCredentialResponse(authResult) {
  fetch(`${api}/auth/login`, {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({
      jwt: authResult,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(readJson)
    .then((data) => {
      if (data.result == "success") {
        window.location.href = `${projectUrl}/game`;
      } else {
        alert(loginFailed);
      }
    })
    .catch((error) => {
      // 오류 문자열을 그대로 띄우면 내부 사정만 새어 나가고 사용자는 할 수 있는
      // 일이 없습니다. 사람에게는 번역된 문구를, 진단용 원문은 콘솔에 남깁니다.
      console.error(error);
      alert(loginError);
    });
}
