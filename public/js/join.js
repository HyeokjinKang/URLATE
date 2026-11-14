/* global api, projectUrl, joini18n */

// A 4xx/5xx response body isn't guaranteed to be JSON (a proxy's HTML error page,
// for example), so check the status before parsing to avoid a misleading error.
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
          const reason = {
            "Exist Name": joini18n.nameExist,
            "Reserved Name": joini18n.nameReserved,
          }[data.error];
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
        console.error(error);
        alert(joini18n.error);
      });
  }
};

document.getElementById("submit").addEventListener("click", check);

document.addEventListener("keydown", (event) => {
  if (event.code == "Enter") {
    check();
  }
});
