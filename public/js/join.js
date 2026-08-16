/* global api, projectUrl, joini18n */

// 응답 본문을 읽기 전에 상태 코드를 봅니다. 4xx·5xx는 본문이 JSON이 아닐 수
// 있어(프록시가 낸 HTML 오류 페이지 등) 곧바로 json()을 부르면 파싱 오류가 나고,
// 실제 원인과 무관한 메시지가 사용자에게 노출됩니다.
// index.js에도 같은 헬퍼가 있습니다. 두 파일 모두 GSI 콜백을 전역으로 노출해야
// 해서 클래식 스크립트이고, 공유 파일로 빼려면 뷰의 로딩 순서까지 바꿔야 합니다.
function readJson(res) {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

document.addEventListener("DOMContentLoaded", () => {
  fetch(`${api}/auth/status`, {
    method: "GET",
    credentials: "include",
  })
    .then(readJson)
    .then((data) => {
      if (data.status == "Logined") {
        window.location.href = `${projectUrl}/game`;
      } else if (data.status == "Not logined") {
        window.location.href = projectUrl;
      }
      if (nameReg.test(data.tempName)) {
        document.getElementById("nickname").value = data.tempName;
      }
    })
    .catch((error) => {
      // 로그인 상태 확인 실패로 가입 화면을 막지는 않습니다. 닉네임을 넣고
      // 제출하는 흐름은 그대로 쓸 수 있으므로 콘솔에만 남깁니다.
      console.error(error);
    });
});

const nameReg = /^[a-zA-Z0-9_-]{5,12}$/;

document.getElementById("nickname").addEventListener(
  "blur",
  () => {
    requestAnimationFrame(() => {
      if (!nameReg.test(document.getElementById("nickname").value)) {
        document.getElementById("name").classList.add("show");
      } else {
        document.getElementById("name").classList.remove("show");
      }
    });
  },
  true,
);

const check = () => {
  if (!nameReg.test(document.getElementById("nickname").value)) {
    document.getElementById("name").classList.add("show");
  } else {
    document.getElementById("name").classList.remove("show");
    document.getElementById("nameExist").classList.remove("show");
    fetch(`${api}/auth/join`, {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({
        displayName: document.getElementById("nickname").value,
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
          // A rejection the user fixes by changing the name stays next to the field.
          const reason = { "Exist Name": joini18n.nameExist, "Reserved Name": joini18n.nameReserved }[data.error];
          if (reason) {
            const el = document.getElementById("nameExist");
            el.textContent = reason;
            el.style.display = "initial";
            el.classList.add("show");
          } else {
            console.error(data);
            alert(joini18n.error);
          }
        }
      })
      .catch((error) => {
        // 오류 문자열을 그대로 띄우면 내부 사정만 새어 나가고 사용자는 할 수 있는
        // 일이 없습니다. 사람에게는 번역된 문구를, 진단용 원문은 콘솔에 남깁니다.
        console.error(error);
        alert(joini18n.error);
      });
  }
};

// CSP를 걸기 위해 제출 버튼의 onclick 속성에서 옮겨온 것입니다.
document.getElementById("submit").addEventListener("click", check);

document.addEventListener("keydown", (event) => {
  if (event.code == "Enter") {
    check();
  }
});
