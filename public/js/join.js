/* global api, projectUrl, joini18n */
document.addEventListener("DOMContentLoaded", () => {
  fetch(`${api}/auth/status`, {
    method: "GET",
    credentials: "include",
  })
    .then((res) => res.json())
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
      alert(`Error occured.\n${error}`);
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
      .then((res) => res.json())
      .then((data) => {
        if (data.result == "success") {
          window.location.href = `${projectUrl}/game`;
        } else if (data.result == "failed") {
          // 사용자가 이름만 바꾸면 되는 거부는 입력란 옆에 그대로 보여 줍니다.
          const reason = { "Exist Name": joini18n.nameExist, "Reserved Name": joini18n.nameReserved }[data.error];
          if (reason) {
            const el = document.getElementById("nameExist");
            el.textContent = reason;
            el.style.display = "initial";
            el.classList.add("show");
          } else {
            alert("join failed.");
            console.log(data);
          }
        }
      })
      .catch((error) => {
        alert(`Error occured.\n${error}`);
      });
  }
};

document.addEventListener("keydown", (event) => {
  if (event.code == "Enter") {
    check();
  }
});
