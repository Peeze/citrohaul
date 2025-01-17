// Silly project inspired by Nitrohaul.
//
// TODO:
// - Add better textures (wheels, lemons, ground)
// - Add sound design
// - Make objects deletable
// - Make joints deletable
// - Make bodies composable of different parts
//
// Created by (c) Peeze 2025.
// Mozilla Public License 2.0

// Set the UP
// module aliases
var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Body = Matter.Body,
    Bodies = Matter.Bodies,
    Bounds = Matter.Bounds,
    Events = Matter.Events,
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

// Modify render options (setting them in the options above does not work for some reason)
render.options.hasBounds = true;

// Options for drawing mode
render.options.wireframes = true;
render.options.showAxes = true;
render.options.wireframeBackground = "#2E3561";

// Options for simulation mode
render.options.background = "#FFFFF2";


// Keep list of different objects
var wheels = [];
var lemons = [];
var nonStaticParts = [];
var joints = [];

// Dynamic canvas size depending on container size
// Follow lemons around
var viewHeight = 1000;
var viewWidth = viewHeight * canvas.offsetWidth / canvas.offsetHeight;

function setCanvasBounds() {
    Render.setSize(render, viewWidth, viewHeight);

    // Average position of lemons
    if (lemons.length != 0) {
        var position = Vector.create(0, 0);
        for (const lemon of lemons) {
            position = Vector.add(position, lemon.position);
        }
        position = Vector.div(position, lemons.length);

        // Substract half canvas width and height to centre view
        position = Vector.sub(position, Vector.div(Vector.create(viewWidth, viewHeight), 2));

        // Limit view so it does not fall under "ground level"
        position.y = Math.min(position.y, -viewHeight);
        Bounds.shift(render.bounds, position);
    } else {
        Bounds.shift(render.bounds, Vector.create(0, -viewHeight));
    }
}

// Calculate view before render
Events.on(render, "beforeRender", (e) => {
    setCanvasBounds();
});
// Adjust viewWidth when canvas size changes
addEventListener("resize", (e) => {
    viewWidth = viewHeight * canvas.offsetWidth / canvas.offsetHeight;
});
// Scroll to change viewHeight
addEventListener("wheel", (e) => {
    viewHeight += e.deltaY;
    viewHeight = Math.max(Math.min(viewHeight, 3000), 300);
    viewWidth = viewHeight * canvas.offsetWidth / canvas.offsetHeight;
});

// Run the ENGINE
// run the renderer
Render.run(render);

// Create runner and run the engine
var runner = Runner.create();
runner.enabled = false;
Runner.run(runner, engine);

// Populate the WORLD
// create a ground
var groundOptions = {
    isStatic: true,
    friction: 1,
    render: {
        fillStyle: "#90BE6D",
        sprite: {
            texture: "img/ground.png",
            yOffset: 0.1
        }
    }
}
var ground = [];
for (var x = -5000; x < 5000; x += 499) {
    var groundElement = Bodies.rectangle(x, 0, 500, 80, groundOptions);
    groundElement.bodyType = "ground";
    ground.push(groundElement);
}

// add all of the bodies to the world
Composite.add(engine.world, ground);

// Class to contain factory functions for each type of object to be created
class BodyType {
    static WHEEL = new BodyType("wheel");
    static CIRCLE = new BodyType("circle");
    static PLANK = new BodyType("plank");
    static BOX = new BodyType("box");
    static JOINT = new BodyType("joint");
    static SPRING = new BodyType("spring");
    static LEMON = new BodyType("lemon");
    static DRAG = new BodyType("drag");

    constructor(type) {
        this.type = type;

        // Set default options, depending on type
        switch (this.type) {
            case "wheel":
                this.options = {
                    restitution: 0.3,
                    friction: 0.8,
                    frictionStatic: 10,
                    frictionAir: 0.0005,
                    render: {
                        sprite: {
                            texture: "img/wheel2_512px.png",
                        }
                    }
                }
                break;
            case "circle":
            case "plank":
            case "box":
                this.options = {
                    restitution: 0.3,
                    friction: 0.8,
                    frictionStatic: 2,
                    frictionAir: 0.0005,
                    render: {
                        fillStyle: "#3E3D3D"
                    }
                }
                break;
            case "joint":
                this.options = {
                    render: {
                        strokeStyle: runner.enabled ? "#858585" : "#FFFFFF"
                    }
                };
                break;
            case "spring":
                this.options = {
                    stiffness: 0.05,
                    render: {
                        strokeStyle: runner.enabled ? "#858585" : "#FFFFFF"
                    }
                }
                break;
            case "lemon":
                this.options = {
                    restitution: 0.1,
                    friction: 0.5,
                    frictionStatic: 2,
                    frictionAir: 0.0005,
                    setDensity: 0.005,
                    render: {
                        fillStyle: "#f9c74f",
                        sprite: {
                            texture: "img/lemon2_64px.png",
                            xScale: 0.65,
                            yScale: 0.65,
                            xOffset: -0.1,
                            yOffset: 0.1
                        }
                    }
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
                var spriteScale = radius / 256;
                body[0].render.sprite.xScale = spriteScale;
                body[0].render.sprite.yScale = spriteScale;

                // "Static wheels": not static for matter.js purposes, but
                // constrained to their position, so that they can spin in a
                // fixed position
                // Return a list containing the wheel and the constraint.
                if (shiftKey && bodyType.type == "wheel") {
                    body.push(Constraint.create({bodyA: body[0], pointB: Vector.create(objX, objY)}));
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
                var angle = (diffX != 0) ? Math.atan(diffY / diffX) : Math.PI / 2;
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
                var allBodies = Composite.allBodies(engine.world);

                // Get bodies at end points of constraint
                var pointA = Vector.create(objX, objY);
                var bodyA;
                // Do not put constraints on lemons (select first non-lemon
                // from list of objects at point)
                for (var body of Query.point(allBodies, pointA)) {
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

                // Get bodies at end points of constraint
                var pointB = Vector.create(mouseX, mouseY);
                var bodyB;
                // Do not put constraints on lemons (select first non-lemon
                // from list of objects at point)
                // Do not select same body as bodyA
                for (var body of Query.point(allBodies, pointB)) {
                    if (body.bodyType != "lemon" && body !== bodyA) {
                        bodyB = body;
                        break;
                    }
                }
                // If body is not null, calculate offset from centre
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
                        (!bodyA || !bodyB)
                        || bodyA === bodyB)) {
                    return [];
                }

                body = [Constraint.create(
                    {...this.options, ...options,
                    bodyA: bodyA, bodyB: bodyB,
                    pointA: pointA, pointB: pointB})];
                break;

            case "lemon":
                var radius = 16;

                // Cannot be static, override isStatic option
                body = [Bodies.circle(
                    mouseX, mouseY,
                    radius,
                    {...this.options, ...options, isStatic: !options.mouseup})];
                break;

            case "drag":
                // 1. Get body under mouse
                if (options.mousedown) {
                    // List of all bodies in the world
                    var allBodies = Composite.allBodies(engine.world);

                    // Get bodies at end points of constraint
                    var point = Vector.create(mouseX, mouseY);
                    var bodyHit;
                    // Do not drag or delete ground
                    for (var body of Query.point(allBodies, point)) {
                        if (body.bodyType != "ground") {
                            bodyHit = body;
                            break;
                        }
                    }

                    // On doubeclick: delete
                    if (bodyHit && options.doubleclick) {
                        // Remove body
                        Composite.remove(engine.world, bodyHit);

                        // Remove constraints
                        for (const constraint of joints) {
                            if (constraint.bodyA === bodyHit || constraint.bodyB === bodyHit) {
                                Composite.remove(engine.world, constraint);
                            }
                        }
                        return [];
                    }

                    // Save reference to body and offset from mouse in newBodyProperties
                    if (bodyHit) {
                        newBodyProperties.body = bodyHit;
                        // Offset of object position from mouse
                        newBodyProperties.offsetX = bodyHit.position.x - mouseX;
                        newBodyProperties.offsetY = bodyHit.position.y - mouseY;

                        // "Staticness", reinstate on mouseup
                        newBodyProperties.isStatic = bodyHit.isStatic;

                        // List of constraints
                        newBodyProperties.constraints = [];
                        for (const constraint of joints) {
                            // Only fixed joints, not springs
                            if (constraint.bodyType == "joint"
                                && (constraint.bodyA === bodyHit || constraint.bodyB === bodyHit)) {
                                newBodyProperties.constraints.push(constraint);
                            }
                        }

                        // Make static while being moved
                        Body.setStatic(bodyHit, true);
                    }


                } else {
                    // Get reference to body
                    var bodyHit = newBodyProperties.body;
                }

                if (bodyHit) {
                    // 2. Set position
                    var newPosition = Vector.create(
                        mouseX + newBodyProperties.offsetX,
                        mouseY + newBodyProperties.offsetY);
                    Body.setPosition(bodyHit, newPosition);

                    // 3. Adjust constraints
                    for (const constraint of newBodyProperties.constraints) {
                        constraint.length = Constraint.currentLength(constraint);
                        if (constraint.length != 0) {
                            constraint.render.type = "line";
                            constraint.render.anchors = true;
                        } else {
                            constraint.render.type = "pin";
                            constraint.render.anchors = false;
                        }
                    }

                    // 4. Reinstate "staticness"
                    if (options.mouseup) {
                        // On mouseup, reinstate static property
                        Body.setStatic(bodyHit, newBodyProperties.isStatic);
                    }
                }

                // Return no new object to be created
                return [];

            default:
                console.warn(`Body type "${this.type}" not implemented`);
                return null;
        }

        // Add bodyType attribute to body
        body[0].bodyType = this.type;
        return body;
    }

    setFillStyle(fillStyle) {
        switch (this.type) {
            case "circle":
            case "plank":
            case "box":
                this.options.render.fillStyle = fillStyle;
                break;

            default:
                // Pass, do not change colour for other types
        }
    }
}



var bodyType = BodyType.WHEEL; // Current body type
var newBody = null; // Body currently under creation
var newBodyProperties = { };
//var colours = ["#095C47", "#0759B0", "#8A2E19", "#E88EED"];
//var colours = ["#A3A3A3"];

// EVENTS
// Add bodies on mouseclick
// On mousedown: create body at mouse position
addEventListener("mousedown", (e) => {
    if (e.which == 1 && !newBody) {
        // For randomising the colour of an object (currently disabled)
        //newBodyProperties.colour = colours[Math.floor(Math.random() * colours.length)];
        //bodyType.setFillStyle(newBodyProperties.colour);

        newBodyProperties.objX = render.mouse.position.x;
        newBodyProperties.objY = render.mouse.position.y;

        newBody = bodyType.create(
            newBodyProperties.objX, newBodyProperties.objY,
            render.mouse.position.x, render.mouse.position.y,
            { isStatic: true, mousedown: true, doubleclick: e.detail == 2 });
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
        //Body.setStatic(newBody, true);
        // setStatic does not work for objects that were created static, they
        // vanish, create a new body instead

        Composite.remove(engine.world, newBody);

        // Make static object if Shift is pressed
        // Except wheels and lemons
        newBody = bodyType.create(
            newBodyProperties.objX, newBodyProperties.objY,
            render.mouse.position.x, render.mouse.position.y,
            { mouseup: true, isStatic: shiftKey });
        Composite.add(engine.world, newBody);

        // newBody could be an empty list if no new body is to be created,
        // e.g. a joint with no target bodies
        if (newBody[0]) {
            // Disable collisions with overlapping non-static bodies
            if (!newBody[0].isStatic
                && bodyType !== BodyType.LEMON
                && bodyType !== BodyType.JOINT
                && bodyType !== BodyType.SPRING) {

                // Iterate through all collisions
                var collisions = Query.collides(newBody[0], nonStaticParts.concat(wheels));
                for (const collision of collisions) {
                    if (collision.bodyA.bodyType != "wheel") {
                        collision.bodyA.collisionFilter.mask = -3;
                    }
                    if (collision.bodyB.bodyType != "wheel") {
                        collision.bodyB.collisionFilter.mask = -3;
                    }
                    collision.bodyA.collisionFilter.category = 2;
                    collision.bodyB.collisionFilter.category = 2;
                }
            }

            // Keep lists of different objects
            switch (newBody[0].bodyType) {
                case "wheel":
                    wheels.push(newBody[0]);
                    break;
                case "lemon":
                    lemons.push(newBody[0]);
                    break;
                case "circle":
                case "plank":
                case "box":
                    if (!newBody[0].isStatic) {
                        nonStaticParts.push(newBody[0]);
                    }
                    break;
                case "joint":
                case "spring":
                    joints.push(newBody[0]);
                    break;
            }
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
        case "Digit8":
            if (!newBody) {
                bodyType = BodyType.DRAG;
            }
            break;

        // Shift: toggle global variable shiftKey
        case "ShiftLeft":
        case "ShiftRight":
            shiftKey = true;
            break;

        // Spacebar: toggle drawing/simulation mode
        // Pause the engine, change colour scheme
        case "Space":
            runner.enabled = !runner.enabled;
            render.options.wireframes = !render.options.wireframes;
            render.options.showAxes = !render.options.showAxes;

            // Change colour of joints
            var strokeStyle = runner.enabled ? "#858585" : "#FFFFFF";
            BodyType.JOINT.options.render.strokeStyle = strokeStyle;
            BodyType.SPRING.options.render.strokeStyle = strokeStyle;
            for (const joint of joints) {
                joint.render.strokeStyle = strokeStyle;
            }
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
