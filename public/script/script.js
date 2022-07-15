const input = document.querySelector(".input");
const shorten_btn = document.querySelector(".shorten-btn");
const added_template = document.querySelector(".added-template");
const container = document.querySelector(".container");
const section = document.querySelector(".section");
const hamburger = document.querySelector(".hamburger");
const desk_ul = document.querySelector(".desk-ul");
const right_side = document.querySelector(".right-side");
const alert_i = document.querySelector(".alert-i");

let Cpt = 0,
    urlValid = /^(ftp|http|https):\/\/[^ "]+$/;

alert_i.style.opacity = "0";

async function API(value) {
    try {
        const Response = await fetch(`https://api.shrtco.de/v2/shorten?url=${value}/`);
        const Data = await Response.json();
        return Data;
    } catch (error) {
        return error.message;
    }
}

hamburger.addEventListener("click", function () {
    Cpt++;
    if (Cpt % 2 == 1) {
        hamburger.setAttribute("src", "images/bars-staggered-solid.svg");
    } else {
        hamburger.setAttribute("src", "images/bars-solid.svg");
    }
    desk_ul.classList.toggle("desk-ul-style");
    right_side.classList.toggle("right-side-style");
})

shorten_btn.addEventListener("click", async function () {
    let Content = await API(input.value);

    if ((urlValid.test(input.value)) && (input.value.includes(".")) && (Content.ok == true)) {
        let primaryDiv = document.createElement("div");
        primaryDiv.classList.add("added", "wow", "fadeIn");
        let paragraph = document.createElement("p");
        paragraph.textContent = input.value;
        let innerDiv = document.createElement("div");
        let aHref = document.createElement("a");
        aHref.setAttribute("target", "_blank");
        aHref.setAttribute("href", Content.result.full_short_link);
        aHref.textContent = Content.result.full_short_link;
        let copyBtn = document.createElement("button");
        copyBtn.classList.add("exc", "new-copy-btn", "input-btn");
        copyBtn.textContent = 'Copy';

        container.appendChild(primaryDiv);
        primaryDiv.append(paragraph, innerDiv);
        innerDiv.append(aHref, copyBtn);
        added_template.remove();
        input.classList.remove("input-check-green");

        function backOldStyle() {
            copyBtn.textContent = "Copy";
            copyBtn.classList.remove("copy-btn-style");
        }

        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(Content.result.full_short_link);
            copyBtn.textContent = "Copied!";
            copyBtn.classList.add("copy-btn-style");
            setTimeout(backOldStyle, 3500);
        })
    } else {
        alert("invalid input ... try again!");
    }
    input.value = '';
})

input.addEventListener("keyup", function () {
    if (urlValid.test(input.value)) {
        input.classList.add("input-check-green");
        alert_i.style.opacity = "0";
        input.classList.remove("input-check-red");
    } else {
        input.classList.add("input-check-red");
        input.classList.remove("input-check-green");
        alert_i.style.opacity = "1";
    }
})