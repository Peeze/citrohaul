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
render.options.wireframes = true;
render.options.background = "#FEF2D8";  // Background color (for later)
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

// Create runner and run the engine
var runner = Runner.create();
runner.enabled = false;
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
Composite.add(engine.world, [ground]);

// Keep list of wheels
var wheels = [];

// Class to contain factory functions for each type of object to be created
class BodyType {
    static WHEEL = new BodyType("wheel");
    static CIRCLE = new BodyType("circle");
    static PLANK = new BodyType("plank");
    static BOX = new BodyType("box");
    static JOINT = new BodyType("joint");
    static SPRING = new BodyType("spring");
    static LEMON = new BodyType("lemon");

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
                this.options = { };
                break;
            case "spring":
                this.options = {
                    stiffness: 0.1
                }
                break;
            case "lemon":
                this.options = {
                    restitution: 0.1,
                    friction: 0.5,
                    frictionStatic: 10,
                    setDensity: 0.005
                }
                break;
            default:
                this.options = { };
        }
    }

    // Return new object of the given type
    // Returns a list with the object at index 0 followed by any other objects
    // to be created (such as constraints)
    create(objX, objY, mouseX, mouseY, options) {
        var body;
        switch (this.type) {
            case "wheel":
                // Same shape as circle, but will be tracked in a list
                // Final body cannot be static, override isStatic option
                var radius = Vector.magnitude(Vector.create(mouseX - objX, mouseY - objY));
                radius = Math.max(radius, 10);
                body = [Bodies.circle(objX, objY, radius,
                    {...this.options, ...options, isStatic: !options.mouseup})];

                // "Static wheels": not static for matter.js purposes, but
                // constrained to their position, so that they can spin in a
                // fixed position
                // Return a list containing the wheel and the constraint.
                if (shiftKey && bodyType.type == "wheel") {
                    body.push(Constraint.create({bodyA: body[0], pointB: Vector.create(objX, objY)}));
                    console.log(body[1]);
                }

                break;

            case "circle":
                var radius = Vector.magnitude(Vector.create(mouseX - objX, mouseY - objY));
                radius = Math.max(radius, 10);
                body = [Bodies.circle(objX, objY, radius,
                    {...this.options, ...options})];
                break;

            case "plank":
                var midX = (objX + mouseX) / 2;
                var midY = (objY + mouseY) / 2;
                var diffX = mouseX - objX;
                var diffY = mouseY - objY;
                var angle = (diffX != 0) ? Math.atan(diffY / diffX) : 0;
                var length = Math.sqrt(diffX * diffX + diffY * diffY);

                body = [Bodies.rectangle(
                    (objX + mouseX) / 2, (objY + mouseY) / 2,
                    length, 10,
                    {...this.options, ...options, angle: angle})];
                break;

            case "box":
                body = [Bodies.rectangle(
                    (objX + mouseX) / 2, (objY + mouseY) / 2,
                    mouseX - objX, mouseY - objY,
                    {...this.options, ...options})];
                break;

            case "spring":
                // Same as joints, with different options
            case "joint":
                // List of all bodies in the world
                var bodies = Composite.allBodies(engine.world);

                // Get bodies at end points of constraint
                var pointA = Vector.create(objX, objY);
                var bodyA;
                // Do not put constraints on lemons (select first non-lemon
                // from list of objects at point)
                for (var body of Query.point(bodies, pointA)) {
                    if (body.bodyType != "lemon") {
                        bodyA = body;
                        break;
                    }
                }
                // If body is not null, calculate offset from centre
                if (bodyA) {
                    pointA = Vector.sub(pointA, bodyA.position);
                    // For wheels, snap to center if sufficiently close
                    if (bodyA.bodyType == "wheel" && Vector.magnitude(pointA) < 10) {
                        pointA = Vector.create(0, 0);
                    }
                }

                var pointB = Vector.create(mouseX, mouseY);
                var bodyB;
                // Do not put constraints on lemons (select first non-lemon
                // from list of objects at point)
                for (var body of Query.point(bodies, pointB)) {
                    if (body.bodyType != "lemon") {
                        bodyB = body;
                        break;
                    }
                }
                // If body is not null, calculate offset from centre
                // For wheels, snap to center if sufficiently close
                if (bodyB) {
                    pointB = Vector.sub(pointB, bodyB.position);
                    // For wheels, snap to center if sufficiently close
                    if (bodyB.bodyType == "wheel" && Vector.magnitude(pointB) < 10) {
                        pointB = Vector.create(0, 0);
                    }
                }

                // Do not add to the world if:
                // - Both start and end of constraints are not a body
                // - Start and end are the same body
                if (options.mouseup && (
                        (!bodyA && !bodyB)
                        || bodyA === bodyB)) {
                    return [];
                }

                body = [Constraint.create(
                    {...this.options, ...options,
                    bodyA: bodyA, bodyB: bodyB,
                    pointA: pointA, pointB: pointB})];
                break;

            case "lemon":
                var radius = 15;

                // Cannot be static, override isStatic option
                body = [Bodies.circle(
                    mouseX, mouseY,
                    radius,
                    {...this.options, ...options, isStatic: !options.mouseup})];
                break;

            default:
                console.warn(`Body type "${this.type}" not implemented`);
                return null;
        }

        // Add bodyType attribute to body
        body[0].bodyType = this.type;
        return body;
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
    if (!newBody) {
        newBodyProperties.objX = render.mouse.position.x;
        newBodyProperties.objY = render.mouse.position.y;

        newBody = bodyType.create(
            newBodyProperties.objX, newBodyProperties.objY,
            render.mouse.position.x, render.mouse.position.y,
            { isStatic: true });
        Composite.add(engine.world, newBody);
    }
});

// On mousemove: update newBody
addEventListener("mousemove", (e) => {
    if (newBody) {
        Composite.remove(engine.world, newBody);
        newBody = bodyType.create(
            newBodyProperties.objX, newBodyProperties.objY,
            render.mouse.position.x, render.mouse.position.y,
            { isStatic: true });
        Composite.add(engine.world, newBody);
    }
});

// On mouseup: release newBody
addEventListener("mouseup", (e) => {
    if (newBody) {
        //Body.setStatic(newBody, true);  // setStatic bugs, objects vanish, create a new body instead

        Composite.remove(engine.world, newBody);

        // Make static object if Shift is pressed
        // Except wheels and lemons
        newBody = bodyType.create(
            newBodyProperties.objX, newBodyProperties.objY,
            render.mouse.position.x, render.mouse.position.y,
            { mouseup: true, isStatic: shiftKey });
            Composite.add(engine.world, newBody);

        // Keep list of all wheels
        if (bodyType === BodyType.WHEEL) {
            wheels.push(newBody[0]);
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

// Global variable
var shiftKey = false;

// On keydown
addEventListener("keydown", (e) => {
    switch (e.code) {
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
        // Do not change while a body is created
        // If Shift is pressed, create static object
        case "Digit1":
            if (!newBody) {
                bodyType = BodyType.WHEEL;
            }
            break;
        case "Digit2":
            if (!newBody) {
                bodyType = BodyType.CIRCLE;
            }
            break;
        case "Digit3":
            if (!newBody) {
                bodyType = BodyType.PLANK;
            }
            break;
        case "Digit4":
            if (!newBody) {
                bodyType = BodyType.BOX;
            }
            break;
        case "Digit5":
            if (!newBody) {
                bodyType = BodyType.JOINT;
            }
            break;
        case "Digit6":
            if (!newBody) {
                bodyType = BodyType.SPRING;
            }
            break;
        case "Digit7":
            if (!newBody) {
                bodyType = BodyType.LEMON;
            }
            break;

        // Shift: toggle global variable shiftKey
        case "ShiftLeft":
        case "ShiftRight":
            shiftKey = true;
            break;

        // Spacebar: pause the engine
        case "Space":
            runner.enabled = !runner.enabled;
            break;
    }
});

addEventListener("keyup", (e) => {
    switch (e.code) {
        // Shift: toggle global variable shiftKey
        case "ShiftLeft":
        case "ShiftRight":
            shiftKey = false;
            break;
    }
});

