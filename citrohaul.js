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
    Query = Matter.Query,
    Composite = Matter.Composite,
    Constraint = Matter.Constraint;

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

// Keep list of wheels
var wheels = [];

// Class to contain factory functions for each type of object to be created
class BodyType {
    static WHEEL = new BodyType("wheel");
    static CIRCLE = new BodyType("circle");
    static PLANK = new BodyType("plank");
    static BOX = new BodyType("box");
    static JOINT = new BodyType("joint");

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
            case "circle":
            case "plank":
            case "box":
                this.options = {
                    restitution: 0.3,
                    friction: 0.8,
                    frictionStatic: 10
                }
                break;
            case "joint":
                this.options = {
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
            case "plank":
                var midX = (objX + mouseX) / 2;
                var midY = (objY + mouseY) / 2;
                var diffX = mouseX - objX;
                var diffY = mouseY - objY;
                var angle = 0;
                if (diffX != 0) {
                    angle = Math.atan(diffY / diffX);
                }
                var length = Math.sqrt(diffX * diffX + diffY * diffY);

                return Bodies.rectangle(
                    (objX + mouseX) / 2, (objY + mouseY) / 2,
                    length, 10,
                    {...this.options, ...options, angle: angle});
            case "box":
                return Bodies.rectangle(
                    (objX + mouseX) / 2, (objY + mouseY) / 2,
                    mouseX - objX, mouseY - objY,
                    {...this.options, ...options});
            case "joint":
                var bodies = Composite.allBodies(engine.world);
                var pointA = Vector.create(objX, objY);
                var bodyA = Query.point(bodies, pointA)[0];
                if (bodyA) {pointA = null;}  // Only pass either pointA or bodyA

                var pointB = Vector.create(mouseX, mouseY);
                var bodyB = Query.point(bodies, pointB)[0];
                if (bodyB) {pointB = null;}  // Only pass either pointA or bodyA

                // If start and end of constraints are not a Body, do not add
                // it to the world
                if (!bodyA && !bodyB && options.mouseup) {
                    return undefined;
                }

                return Constraint.create(
                    {...this.options, ...options,
                    bodyA: bodyA, bodyB: bodyB,
                    pointA: pointA, pointB: pointB});
            default:
                console.warn(`Body type "${this.type}" not implemented`);
        }
    }
}

var bodyType = BodyType.WHEEL; // Current body type
var newBody = null; // Body currently under creation
var newBodyProperties = { };

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
        newBody = bodyType.create(newBodyProperties.objX, newBodyProperties.objY, mouseX, mouseY, { mouseup: true });
        if (newBody) {
            Composite.add(engine.world, newBody);
        }

        // Keep list of all wheels
        if (bodyType === BodyType.WHEEL) {
            wheels.push(newBody);
        }

        newBody = null;
        newBodyProperties = { };
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
                bodyType = BodyType.PLANK;
            }
            break;
        case "4":
            if (!newBody) {
                bodyType = BodyType.BOX;
            }
            break;
        case "5":
            if (!newBody) {
                bodyType = BodyType.JOINT;
            }
            break;
    }
});
