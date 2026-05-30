// Pointer-driven parallax: tilts the .stage toward the cursor and drifts the
// shader the opposite way, so the glass layers separate in depth (Framer-ish).
// Smoothed with a lerp loop; disabled under prefers-reduced-motion.
export function initParallax() {
    const stage = document.querySelector(".stage");
    if (!stage)
        return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
    const root = document.documentElement;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener("pointermove", (e) => {
        tx = (e.clientX / window.innerWidth - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    window.addEventListener("pointerleave", () => { tx = 0; ty = 0; });
    const loop = () => {
        cx += (tx - cx) * 0.08;
        cy += (ty - cy) * 0.08;
        stage.style.setProperty("--ry", (cx * 6).toFixed(2) + "deg");
        stage.style.setProperty("--rx", (-cy * 6).toFixed(2) + "deg");
        root.style.setProperty("--px", (cx * -16).toFixed(1) + "px");
        root.style.setProperty("--py", (cy * -16).toFixed(1) + "px");
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}
