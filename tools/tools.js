document.addEventListener('DOMContentLoaded', function() {
    //Disable all visually hidden buttons inside tool sliders.
    let toolSlidersLocator = ".button-fixer-tester";
    waitForElementToExist(toolSlidersLocator).then((el) => {
        document.querySelectorAll(".button-fixer-tester").forEach(el => {
            el.querySelectorAll("button").forEach(button => {
                button.disabled = true;
            });
        });
    });
});

var openedToggle = null;
function toggleSubTab(el) {
    let isShow = !el.getElementsByClassName("button-fixer-tester-name")[0].classList.contains("active");
    buttonAnimations(el, isShow);
    let buttonId = el.id;
    let contentWrapper = jQuery(`#${buttonId.replace("button", "wrapper")}`);
    if (!isShow) {
        el.querySelectorAll("button").forEach(button => {
            button.disabled = true;
        });
        contentWrapper.slideUp(800);
    }  else {
        el.querySelectorAll("button").forEach(button => {
            button.disabled = false;
        });
        contentWrapper.slideDown(800);
    }
}

function buttonAnimations(el, isShow) {
    let name = el.getElementsByClassName("button-fixer-tester-name")[0];
    let description = el.getElementsByClassName("button-fixer-tester-description")[0];
    let options = el.getElementsByClassName("button-fixer-tester-selected-options")[0];
    if (isShow) {
        name.classList.add("active");
        description.classList.add("active");
        options.classList.add("active");
    } else {
        name.classList.remove("active");
        description.classList.remove("active");
        options.classList.remove("active");
    }
}