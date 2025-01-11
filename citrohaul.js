// Set the UP
var DEBUG_MODE = true;

// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Bounds = Matter.Bounds,
    Vector = Matter.Vector,
    Mouse = Matter.Mouse,
    Composite = Matter.Composite;

// create an engine
var engine = Engine.create();

// create a renderer
var canvas = document.getElementById("render-canvas");
var mouse = Mouse.create(canvas);

var render = Render.create({
    canvas: canvas,
    engine: engine,
    mouse: mouse
});

// Modify options directly (setting them upon creation does not work for some reason)
render.options.hasBounds = true;
if (DEBUG_MODE) {
    render.options.showAxes = true;
    render.options.showMousePosition = true;
}

// Dynamic canvas size depending on container size
function setCanvasBounds(viewHeight) {
    var viewWidth = viewHeight * canvas.offsetWidth / canvas.offsetHeight;
    Render.setSize(render, viewWidth, viewHeight);
    Bounds.shift(render.bounds, Vector.create(-viewWidth / 2, 0));
}

setCanvasBounds(1000);
addEventListener("resize", (e) => {
    setCanvasBounds(1000);
});

// Run the ENGINE
// run the renderer
Render.run(render);

// create runner
var runner = Runner.create();

// run the engine
Runner.run(runner, engine);

// Populate the WORLD
// create boxes and a ground
var boxOptions = {
    restitution: 0.5,
    friction: 0.4,
    frictionStatic: 1.5,
    frictionAir: 0
}

var ground = Bodies.rectangle(0, 1000, 8000, 80, { isStatic: true });
var box0 = Bodies.rectangle(50, 50, 80, 80, { isStatic: true });
var box1 = Bodies.rectangle(50, 950, 80,80, { isStatic: true });
var box2 = Bodies.rectangle(950, 50, 80, 80, { isStatic: true });
var box3 = Bodies.rectangle(950, 950, 80, 80, { isStatic: true });

// add all of the bodies to the world
Composite.add(engine.world, [ground, box0, box1, box2, box3]);

// Add bodies on mouseclick
// Currently created body
var newBody = null;

// List of created circles
var circles = [];

// On mousedown: create body at mouse position
addEventListener("mousedown", (e) => {
    var mouseX = render.mouse.position.x;
    var mouseY = render.mouse.position.y;
    newBody = Bodies.circle(mouseX, mouseY, 10, { isStatic: true });
    Composite.add(engine.world, newBody);
});

// On mousemove: update newBody
addEventListener("mousemove", (e) => {
    if (newBody) {
        var objX = newBody.position.x;
        var objY = newBody.position.y;
        var mouseX = render.mouse.position.x;
        var mouseY = render.mouse.position.y;
        var radius = Vector.magnitude(Vector.create(mouseX - objX, mouseY - objY));
        radius = Math.max(radius, 10);

        Composite.remove(engine.world, newBody);
        newBody = Bodies.circle(objX, objY, radius, { isStatic: true });
        Composite.add(engine.world, newBody);
    }
});

// On mouseup: release newBody
addEventListener("mouseup", (e) => {
    console.log("Mouse up");
    if (newBody) {
        //Body.setStatic(newBody, true);  // setStatic bugs, objects vanish, create a new body instead

        var objX = newBody.position.x;
        var objY = newBody.position.y;
        var mouseX = render.mouse.position.x;
        var mouseY = render.mouse.position.y;
        var radius = Vector.magnitude(Vector.create(mouseX - objX, mouseY - objY));
        radius = Math.max(radius, 10);

        Composite.remove(engine.world, newBody);
        newBody = Bodies.circle(objX, objY, radius, { isStatic: false });
        Composite.add(engine.world, newBody);
        circles.push(newBody);
        newBody = null;
    }
});

// Parameters for wheel torque depending on size
var torque = 0.2;
var responsiveness = 1;  // Determines the difference between small and large wheels (big number, small difference)
var maxVelocity = 0.5;

// On keydown
addEventListener("keydown", (e) => {
    switch (e.key) {
        // Arrow keys: turn wheels
        case "ArrowDown":
            for (let i = 0; i < circles.length; i++) {
                var angularVelocity = (
                    Body.getAngularVelocity(circles[i])
                    - torque / (circles[i].mass + responsiveness));
                angularVelocity = Math.max(angularVelocity, -maxVelocity);
                Body.setAngularVelocity(circles[i], angularVelocity);
            }
            break;
        case "ArrowUp":
            for (let i = 0; i < circles.length; i++) {
                var angularVelocity = (
                    Body.getAngularVelocity(circles[i])
                    + torque / (circles[i].mass + responsiveness));
                angularVelocity = Math.min(angularVelocity, maxVelocity);
                Body.setAngularVelocity(circles[i], angularVelocity);
            }
            break;
    }
});
