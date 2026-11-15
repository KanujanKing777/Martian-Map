const IMAGE_SEQUENCE = [
  ...Array.from({ length: 5 }, function (_, index) { return "aa" + (index + 1) + ".png"; }),
  ...Array.from({ length: 9 }, function (_, index) { return "a" + (index + 1) + ".png"; }),
  ...Array.from({ length: 42 }, function (_, index) { return String(index + 1).padStart(2, "0") + ".png"; })
];

const openButton = document.getElementById("open-panorama");
const overlay = document.getElementById("panorama-overlay");
const viewerContainer = document.getElementById("panorama-viewer");
const closeButton = document.getElementById("close-panorama");
const nextButton = document.getElementById("panorama-next");
const previousButton = document.getElementById("panorama-previous");
const counter = document.getElementById("panorama-count");
const status = document.getElementById("panorama-status");

let viewer = null;
let currentIndex = 0;
let opening = false;
let changing = false;

function imageUrl(index) {
  return new URL("images/" + IMAGE_SEQUENCE[index], document.baseURI).href;
}

function updateNavigation() {
  counter.textContent = (currentIndex + 1) + " / " + IMAGE_SEQUENCE.length;
  const unavailable = !viewer || opening || changing;
  previousButton.disabled = unavailable || currentIndex === 0;
  nextButton.disabled = unavailable || currentIndex === IMAGE_SEQUENCE.length - 1;
}

function showStatus(message) {
  status.textContent = message;
  status.hidden = !message;
}

function preloadImage(url) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload = function () { resolve(); };
    image.onerror = function () { reject(new Error("Could not load " + IMAGE_SEQUENCE[currentIndex] + ".")); };
    image.src = url;
  });
}

async function createViewer() {
  const url = imageUrl(currentIndex);
  await preloadImage(url);
  const { Viewer } = await import("@photo-sphere-viewer/core");
  viewer = new Viewer({
    container: viewerContainer,
    panorama: url,
    defaultYaw: 0,
    navbar: ["zoom", "move", "fullscreen"]
  });
}

async function openPanorama() {
  if (opening) return;
  opening = true;
  overlay.hidden = false;
  openButton.setAttribute("aria-expanded", "true");
  updateNavigation();

  if (!viewer) showStatus("Loading Jezero surface view…");
  try {
    if (!viewer) {
      await createViewer();
    } else {
      showStatus("Loading image…");
      await viewer.setPanorama(imageUrl(currentIndex));
    }
    showStatus("");
    window.dispatchEvent(new Event("resize"));
    closeButton.focus();
  } catch (error) {
    showStatus(error.message || "The surface image could not be loaded.");
  } finally {
    opening = false;
    updateNavigation();
  }
}

async function showImage(index) {
  if (index < 0 || index >= IMAGE_SEQUENCE.length || !viewer || opening || changing) return;
  changing = true;
  currentIndex = index;
  updateNavigation();
  showStatus("Loading image…");
  try {
    await viewer.setPanorama(imageUrl(currentIndex));
    showStatus("");
  } catch (error) {
    showStatus(error.message || "The image could not be loaded.");
  } finally {
    changing = false;
    updateNavigation();
  }
}

function closePanorama() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  openButton.setAttribute("aria-expanded", "false");
  openButton.focus();
}

openButton.setAttribute("aria-expanded", "false");
openButton.addEventListener("click", openPanorama);
closeButton.addEventListener("click", closePanorama);
nextButton.addEventListener("click", function () { showImage(currentIndex + 1); });
previousButton.addEventListener("click", function () { showImage(currentIndex - 1); });

document.addEventListener("keydown", function (event) {
  if (overlay.hidden) return;
  if (event.key === "ArrowUp") {
    event.preventDefault();
    showImage(currentIndex + 1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    showImage(currentIndex - 1);
  } else if (event.key === "Escape") {
    closePanorama();
  }
});

updateNavigation();
