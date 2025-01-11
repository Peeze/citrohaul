// Silly project inspired by Nitrohaul.
//
// Created by (c) Peeze 2025.
// Mozilla Public License 2.0

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

var staticBodyOptions = {
    isStatic: true,
    friction: 1
}

var ground = Bodies.rectangle(0, 1000, 8000, 80, staticBodyOptions);
var box1 = Bodies.rectangle(50, 950, 80,80, staticBodyOptions);
var box3 = Bodies.rectangle(950, 950, 80, 80, staticBodyOptions);
var box4 = Bodies.rectangle(-350, 950, 80, 80, {...staticBodyOptions, angle: Math.PI / 4 });

// add all of the bodies to the world
Composite.add(engine.world, [ground, box1, box3, box4]);


// Class to contain factory functions for each type of object to be created
class BodyType {
    static WHEEL = new BodyType("wheel");
    static CIRCLE = new BodyType("circle");
    static RECTANGLE = new BodyType("rectangle");

    constructor(type) {
        this.type = type;

        // Set default options, depending on type
        switch (this.type) {
            case "wheel":
                this.options = {
                    restitution: 0.3,
                    friction: 0.8,
                    frictionStatic: 10
                }
                break;
            case "rectangle":
                this.options = {
                    restitution: 0.3,
                    friction: 0.8,
                    frictionStatic: 10
                }
            default:
                this.options = { };
        }
    }

    // Return new object of the given type
    create(objX, objY, mouseX, mouseY, options) {
        switch (this.type) {
            case "wheel":
                // Same as circle, but will be added to bookkeeping (list wheels)
            case "circle":
                var radius = Vector.magnitude(Vector.create(mouseX - objX, mouseY - objY));
                radius = Math.max(radius, 10);
                return Bodies.circle(
                    objX, objY,
                    radius,
                    {...this.options, ...options});
            case "rectangle":
                return Bodies.rectangle(
                    (objX + mouseX) / 2, (objY + mouseY) / 2,
                    mouseX - objX, mouseY - objY,
                    {...this.options, ...options});
            default:
                console.warn(`Body type "${this.type}" not implemented`);
        }
    }
}

var bodyType = BodyType.WHEEL; // Current body type
var newBody = null; // Body currently under creation
var newBodyProperties = { };
var wheels = [];

// EVENTS
// Add bodies on mouseclick
// List of created wheels

// On mousedown: create body at mouse position
addEventListener("mousedown", (e) => {
    newBodyProperties.objX = render.mouse.position.x;
    newBodyProperties.objY = render.mouse.position.y;

    newBody = bodyType.create(
        newBodyProperties.objX, newBodyProperties.objY,
        render.mouse.position.x, render.mouse.position.y,
        { isStatic: true });
    Composite.add(engine.world, newBody);
});

// On mousemove: update newBody
addEventListener("mousemove", (e) => {
    if (newBody) {
        var mouseX = render.mouse.position.x;
        var mouseY = render.mouse.position.y;

        Composite.remove(engine.world, newBody);
        newBody = bodyType.create(newBodyProperties.objX, newBodyProperties.objY, mouseX, mouseY, { isStatic: true });
        Composite.add(engine.world, newBody);
    }
});

// On mouseup: release newBody
addEventListener("mouseup", (e) => {
    if (newBody) {
        //Body.setStatic(newBody, true);  // setStatic bugs, objects vanish, create a new body instead

        var mouseX = render.mouse.position.x;
        var mouseY = render.mouse.position.y;

        Composite.remove(engine.world, newBody);
        newBody = bodyType.create(newBodyProperties.objX, newBodyProperties.objY, mouseX, mouseY);
        Composite.add(engine.world, newBody);

        // Keep list of all wheels
        if (bodyType === BodyType.WHEEL) {
            wheels.push(newBody);
        }

        newBody = null;
    }
});

// Parameters for wheel torque depending on size
var torque = 0.2;
var responsiveness = 1;  // Determines the difference between small and large wheels (big number, small difference)
var maxVelocity = 0.5;

// Add to angular velocity
function turnWheel(wheel, torque, responsiveness, maxVelocity, direction) {
    var angularVelocity = (
        Body.getAngularVelocity(wheel)
        + direction * torque / (wheel.mass + responsiveness));
    // Limit max speed
    // TODO: Max speed should not be limited when rolling down hill
    angularVelocity = Math.min(angularVelocity, maxVelocity);
    angularVelocity = Math.max(angularVelocity, -maxVelocity);
    Body.setAngularVelocity(wheel, angularVelocity);
}

// On keydown
addEventListener("keydown", (e) => {
    switch (e.key) {
        // Arrow keys: turn wheels
        case "ArrowDown":
            for (let i = 0; i < wheels.length; i++) {
                turnWheel(wheels[i], torque, responsiveness, maxVelocity, -1);
            }
            break;
        case "ArrowUp":
            for (let i = 0; i < wheels.length; i++) {
                turnWheel(wheels[i], torque, responsiveness, maxVelocity, 1);
            }
            break;

        // Number keys: change body type
        // (Do not change while a body is created)
        case "1":
            if (!newBody) {
                bodyType = BodyType.WHEEL;
            }
            break;
        case "2":
            if (!newBody) {
                bodyType = BodyType.CIRCLE;
            }
            break;
        case "3":
            if (!newBody) {
                bodyType = BodyType.RECTANGLE;
            }
            break;
    }
});
