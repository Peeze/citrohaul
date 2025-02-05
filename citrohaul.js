// Silly project inspired by Nitrohaul.
//
// TODO:
// - Add better textures (wheels, lemons, ground)
// - Add sound design
// - Save/load creations
//
// Created by (c) Peeze 2025.
// Mozilla Public License 2.0

///////////
// Setup //
///////////

// Module aliases
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

// Create an engine
var engine = Engine.create();

// Create a renderer
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
var constraints = [];

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
        Bounds.shift(render.bounds, Vector.create(-viewWidth / 2, -viewHeight));
    }
}

// Calculate view before render
Events.on(render, "beforeRender", (e) => {
    if (!runner || runner.enabled) {
        setCanvasBounds();
    }
});
// Adjust viewWidth when canvas size changes
// TODO: Prevent that view window resets to starting position
addEventListener("resize", (e) => {
    viewWidth = viewHeight * canvas.offsetWidth / canvas.offsetHeight;
    Render.setSize(render, viewWidth, viewHeight);
    Bounds.shift(render.bounds, Vector.create(-viewWidth / 2, -viewHeight));
});
// Scroll to change viewHeight
addEventListener("wheel", (e) => {
    viewHeight += e.deltaY;
    viewHeight = Math.max(Math.min(viewHeight, 3000), 300);
    viewWidth = viewHeight * canvas.offsetWidth / canvas.offsetHeight;
    Render.setSize(render, viewWidth, viewHeight);
    Bounds.shift(render.bounds, Vector.create(-viewWidth / 2, -viewHeight));
});

// Run the ENGINE
// run the renderer
Render.run(render);

// Create runner and run the engine
var runner = Runner.create();
runner.enabled = false;
Runner.run(runner, engine);


/////////////////////
// Default objects //
/////////////////////

// Create a ground
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
    groundElement.label = "ground";
    ground.push(groundElement);
}

// add all of the bodies to the world
Composite.add(engine.world, ground);


///////////////////////
// User interactions //
///////////////////////

// Add new type of body
Bodies.wheel = function(x, y, radius, options) {
    var sides = 24;
    var spriteScale = radius / 256;
    var defaultOptions = {
        label: "wheel",
        angle: 0.01,
        restitution: 0.3,
        friction: 0.8,
        frictionStatic: 10,
        frictionAir: 0.0005,
        render: {
            sprite: {
                texture: "img/wheel2_512px.png",
                xScale: spriteScale,
                yScale: spriteScale
            }
        }
    };
    return Bodies.polygon(x, y, sides, radius, {...defaultOptions, ...options});
}

// Mouse actions
// Digit1: wheels
let NEW_WHEEL = {
    //label: "wheel",
    minRadius: 20,

    inProgress: false,
    currentAction: { },

    // Create new polygon and add to world
    // The polygon will be created static while the mouse is pressed
    // It serves as a placeholder for the actual wheel that is created when
    // the mouse is released
    mousedown: function(event, engine, render) {
        this.inProgress = true;

        // Save starting position
        this.currentAction.position = Vector.create(
            render.mouse.position.x, render.mouse.position.y);

        // Create wheel with minimum radius as default
        this.currentAction.radius = this.minRadius;
        this.currentAction.body = Bodies.wheel(
            this.currentAction.position.x, this.currentAction.position.y,
            this.currentAction.radius, { isStatic: true}
        );

        // Add to world
        Composite.add(engine.world, this.currentAction.body);
    },

    // Scale polygon to desired size
    mousemove: function(event, engine, render) {
        if (this.inProgress) {
            var newRadius = Vector.magnitude(Vector.sub(this.currentAction.position, render.mouse.position));
            newRadius = Math.max(newRadius, this.minRadius);
            var scale = newRadius / this.currentAction.radius;

            Body.scale(this.currentAction.body, scale, scale);
            this.currentAction.radius = newRadius;

            // Texture scale
            var spriteScale = this.currentAction.radius / 256;
            this.currentAction.body.render.sprite.xScale = spriteScale;
            this.currentAction.body.render.sprite.yScale = spriteScale;
        }
    },

    // Create actual wheel with correct physical properties
    // Add to wheels list
    mouseup: function(event, engine, render) {
        if (this.inProgress) {
            // Remove placeholder polygon
            Composite.remove(engine.world, this.currentAction.body);

            // Create actual wheel body
            this.currentAction.body = Bodies.wheel(
                this.currentAction.position.x, this.currentAction.position.y,
                this.currentAction.radius
            );

            // Add to world
            Composite.add(engine.world, this.currentAction.body);
            wheels.push(this.currentAction.body);

            // "Static wheels": not static for matter.js purposes, but constrained
            // to their position, so that they can spin in a fixed position
            // Return a list containing the wheel and the constraint.
            if (event.shiftKey) {
                this.currentAction.constraint = Constraint.create(
                    {bodyA: this.currentAction.body, pointB: this.currentAction.position,
                     label: "pin"});
                Composite.add(engine.world, this.currentAction.constraint);
                constraints.push(this.currentAction.constraint);
            }

            // Reset currentAction
            this.inProgress = false;
            this.currentAction = { };
        }
    },
}


// For randomising the colour of an object
var colours = ['#f19648', '#f5d259', '#f55a3c', '#063e7b', '#ececd1'];  // Matter.js default
//var colours = ["#095C47", "#0759B0", "#8A2E19", "#E88EED"];  // dark
//var colours = ["#FF85BE", "#FAF19E", "#CDF3DC", "#8DD4F7", "#E4C1F9"];  // pastel
//var colours = ["#A3A3A3"];  // grey
function getRandomColour() {
    return colours[Math.floor(Math.random() * colours.length)];
}

// Handling collisions: merge overlapping bodies into one
// Returns original body if no collisions are found. Otherwise, returns a new
// body with all colliding bodies as parts.
// World should not contain bodies that are compound bodies themselves.
function mergeCollidingParts(body, world) {
    // Get list of collisions, including of body with itself
    var collisions = Query.collides(body, world);

    // Return body if no collisions or only one self-collision
    if (collisions.length == 0) {
        return body;
    } else if (collisions.length == 1 && collisions[0].bodyA === collisions[0].bodyB) {
        return body;
    } else {
        // Get all other bodies from collisions
        var collidingParts = collisions.map((collision) =>
            (collision.bodyA === body)
            ? collision.bodyB : collision.bodyA);

        // If colliding bodies are part of compound bodies, get parent bodies
        // and remove them. Add their parts to the new compound body. Add their
        // constraints to a random part (will be attached to new parent body
        // at the end).
        var additionalParts = [];
        var collidingParents = [];
        for (const part of collidingParts) {
            if (part.parent !== part) {
                // Keep list of parent bodies, avoid duplicates
                if (collidingParents.indexOf(part.parent) < 0) {
                    collidingParents.push(part.parent);

                    // Get parts of parent bodies
                    additionalParts.push(...part.parent.parts.slice(1));
                }
            }
        }

        // Get constraints on all component bodies or their parents
        var collidingConstraintsA = [];
        var collidingConstraintsB = [];
        for (const constraint of constraints) {
            if (collidingParts.indexOf(constraint.bodyA) >= 0
                || collidingParents.indexOf(constraint.bodyA) >= 0) {
                collidingConstraintsA.push(constraint);
            }
            if (collidingParts.indexOf(constraint.bodyB) >= 0
                || collidingParents.indexOf(constraint.bodyB) >= 0) {
                collidingConstraintsB.push(constraint);
            }
        }

        collidingParts.push(...additionalParts);

        // Remove duplicates
        // Set maintains insertion order, body will be first item
        collidingParts = [...new Set(collidingParts)];

        // Add new body to colliding parts, will become parts of overall body
        var parentBody = Body.create({ parts: collidingParts });

        // Attach constraints to new parent body
        // Calculate new offset (Constraints can go crazy for complex bodies,
        // possibly an issue with Matter.js)
        for (const constraint of collidingConstraintsA) {
            var parentConstraint = Constraint.create(
                {bodyA: parentBody, bodyB: constraint.bodyB,
                 pointA: Vector.add(constraint.pointA, Vector.sub(constraint.bodyA.position, parentBody.position)),
                 pointB: constraint.pointB});

            // Replace constraint in world
            Composite.remove(engine.world, constraint);
            Composite.add(engine.world, parentConstraint);

            // Replace constraint in list
            constraints[constraints.indexOf(constraint)] = parentConstraint;
        }
        for (const constraint of collidingConstraintsB) {
            var parentConstraint = Constraint.create(
                {bodyA: constraint.bodyA, bodyB: parentBody,
                 pointA: constraint.pointA,
                 pointB: Vector.add(constraint.pointB, Vector.sub(constraint.bodyB.position, parentBody.position))
                });

            // Replace constraint in world
            Composite.remove(engine.world, constraint);
            Composite.add(engine.world, parentConstraint);

            // Replace constraint in list
            constraints[constraints.indexOf(constraint)] = parentConstraint;
        }

        // Remove colliding parts from world
        Composite.remove(engine.world, collidingParts);
        // Remove parent bodies of component bodies
        Composite.remove(engine.world, collidingParents);

        return parentBody;
    }
}

// Digit2: Circle
let NEW_CIRCLE = {
    minRadius: 20,
    sides: 24,

    matterOptions: {
        label: "circle",
        restitution: 0.3,
        friction: 0.8,
        frictionStatic: 2,
        frictionAir: 0.0005,
        render: {
            fillStyle: "#3E3D3D"
        }
    },

    inProgress: false,
    currentAction: { },

    // Create new polygon and add to world
    // The polygon will be created static while the mouse is pressed
    // It serves as a placeholder for the actual circle that is created when
    // the mouse is released
    mousedown: function(event, engine, render) {
        this.inProgress = true;
        this.matterOptions.render.fillStyle = getRandomColour();

        // Save starting position
        this.currentAction.position = Vector.create(
            render.mouse.position.x, render.mouse.position.y);

        // Create circle with minimum radius as default
        this.currentAction.radius = this.minRadius;
        this.currentAction.body = Bodies.polygon(
            this.currentAction.position.x, this.currentAction.position.y,
            this.sides, this.currentAction.radius,
            {...this.matterOptions, isStatic: true}
        );

        // Add to world
        Composite.add(engine.world, this.currentAction.body);
    },

    // Scale polygon to desired size
    mousemove: function(event, engine, render) {
        if (this.inProgress) {
            var newRadius = Vector.magnitude(Vector.sub(this.currentAction.position, render.mouse.position));
            newRadius = Math.max(newRadius, this.minRadius);
            var scale = newRadius / this.currentAction.radius;

            Body.scale(this.currentAction.body, scale, scale);
            this.currentAction.radius = newRadius;
        }
    },

    // Create actual circle with correct physical properties
    mouseup: function(event, engine, render) {
        if (this.inProgress) {
            // Remove placeholder polygon
            Composite.remove(engine.world, this.currentAction.body);

            // Create actual circle body
            // If shift is pressed: static object
            this.currentAction.body = Bodies.polygon(
                this.currentAction.position.x, this.currentAction.position.y,
                this.sides, this.currentAction.radius,
                {...this.matterOptions, isStatic: event.shiftKey}
            );
            if (!event.shiftKey) {
                nonStaticParts.push(this.currentAction.body);
            }

            // Check for overlaps with other non-static parts. If found, create
            // body of multiple parts.
            this.currentAction.body = mergeCollidingParts(this.currentAction.body, nonStaticParts);

            // Add to world
            Composite.add(engine.world, this.currentAction.body);

            // Reset currentAction
            this.inProgress = false;
            this.currentAction = { };
        }
    },
}


Bodies.plank = function(startX, startY, endX, endY, width, options) {
    var midX = (startX + endX) / 2;
    var midY = (startY + endY) / 2;
    var diffX = endX - startX;
    var diffY = endY - startY;
    var angle = (diffX != 0) ? Math.atan(diffY / diffX) : Math.PI / 2;
    var length = Math.sqrt(diffX * diffX + diffY * diffY) + width;

    return Bodies.rectangle((startX + endX) / 2, (startY + endY) / 2,
        length, width, {...options, angle: angle});
}

// Digit3: Plank
let NEW_PLANK = {
    width: 20,

    matterOptions: {
        label: "plank",
        restitution: 0.3,
        friction: 0.8,
        frictionStatic: 2,
        frictionAir: 0.0005,
        render: {
            fillStyle: "#3E3D3D"
        }
    },

    inProgress: false,
    currentAction: { },

    // Create new rectangle and add to world
    // The rectangle will be created static while the mouse is pressed. It
    // serves as a placeholder for the actual plank that is created when the
    // mouse is released
    mousedown: function(event, engine, render) {
        this.inProgress = true;
        this.matterOptions.render.fillStyle = getRandomColour();

        // Save starting position
        this.currentAction.position = Vector.create(
            render.mouse.position.x, render.mouse.position.y);

        // Create plank with minimum radius as default
        this.currentAction.body = Bodies.plank(
            this.currentAction.position.x, this.currentAction.position.y,
            render.mouse.position.x, render.mouse.position.y,
            this.width, {...this.matterOptions, isStatic: true}
        );

        // Add to world
        Composite.add(engine.world, this.currentAction.body);
    },

    // Update (create new) rectangle based on new mouse position
    // Creating a new rectangle is easier than scaling/rotating/translating
    // the previous one
    mousemove: function(event, engine, render) {
        if (this.inProgress) {
            // Remove previous placeholder rectangle
            Composite.remove(engine.world, this.currentAction.body);

            // Create plank with minimum radius as default
            this.currentAction.body = Bodies.plank(
                this.currentAction.position.x, this.currentAction.position.y,
                render.mouse.position.x, render.mouse.position.y,
                this.width, {...this.matterOptions, isStatic: true}
            );

            // Add to world
            Composite.add(engine.world, this.currentAction.body);
        }
    },

    // Create actual plank with correct physical properties
    mouseup: function(event, engine, render) {
        if (this.inProgress) {
            // Remove previous placeholder rectangle
            Composite.remove(engine.world, this.currentAction.body);

            // Create plank with minimum radius as default
            // If shift is pressed: static object
            this.currentAction.body = Bodies.plank(
                this.currentAction.position.x, this.currentAction.position.y,
                render.mouse.position.x, render.mouse.position.y,
                this.width, {...this.matterOptions, isStatic: event.shiftKey}
            );
            if (!event.shiftKey) {
                nonStaticParts.push(this.currentAction.body);
            }

            // Check for overlaps with other non-static parts. If found, create
            // body of multiple parts.
            this.currentAction.body = mergeCollidingParts(this.currentAction.body, nonStaticParts);

            // Add to world
            Composite.add(engine.world, this.currentAction.body);

            // Reset currentAction
            this.inProgress = false;
            this.currentAction = { };
        }
    },
}

// Digit4: Box
let NEW_BOX = {
    minWidth: 20,

    matterOptions: {
        label: "box",
        restitution: 0.3,
        friction: 0.8,
        frictionStatic: 2,
        frictionAir: 0.0005,
        render: {
            fillStyle: "#3E3D3D"
        }
    },

    inProgress: false,
    currentAction: { },

    padding: function(startX, startY, endX, endY, width) {
        return [(startX + endX) / 2,
                (startY + endY) / 2,
                Math.abs(endX - startX) + width,
                Math.abs(startY - endY) + width ]
    },

    // Create new rectangle and add to world
    // The rectangle will be created static while the mouse is pressed. It
    // serves as a placeholder for the actual box that is created when the
    // mouse is released
    mousedown: function(event, engine, render) {
        this.inProgress = true;
        this.matterOptions.render.fillStyle = getRandomColour();

        // Save starting position
        this.currentAction.position = Vector.create(
            render.mouse.position.x, render.mouse.position.y);

        // Create box with minimum radius as default
        var dimensions = this.padding(
            this.currentAction.position.x, this.currentAction.position.y,
            render.mouse.position.x, render.mouse.position.y, this.minWidth);
        this.currentAction.body = Bodies.rectangle(
            ...dimensions, {...this.matterOptions, isStatic: true}
        );

        // Add to world
        Composite.add(engine.world, this.currentAction.body);
    },

    // Update (create new) rectangle based on new mouse position
    // Creating a new rectangle is easier than scaling/rotating/translating
    // the previous one
    mousemove: function(event, engine, render) {
        if (this.inProgress) {
            // Remove previous placeholder rectangle
            Composite.remove(engine.world, this.currentAction.body);

            // Create box with minimum radius as default
            var dimensions = this.padding(
                this.currentAction.position.x, this.currentAction.position.y,
                render.mouse.position.x, render.mouse.position.y, this.minWidth);
            this.currentAction.body = Bodies.rectangle(
                ...dimensions, {...this.matterOptions, isStatic: true}
            );

            // Add to world
            Composite.add(engine.world, this.currentAction.body);
        }
    },

    // Create actual box with correct physical properties
    mouseup: function(event, engine, render) {
        if (this.inProgress) {
            // Remove previous placeholder rectangle
            Composite.remove(engine.world, this.currentAction.body);

            // Create box with minimum radius as default
            // If shift is pressed: static object
            var dimensions = this.padding(
                this.currentAction.position.x, this.currentAction.position.y,
                render.mouse.position.x, render.mouse.position.y, this.minWidth);
            this.currentAction.body = Bodies.rectangle(
                ...dimensions, {...this.matterOptions, isStatic: event.shiftKey}
            );
            if (!event.shiftKey) {
                nonStaticParts.push(this.currentAction.body);
            }

            // Check for overlaps with other non-static parts. If found, create
            // body of multiple parts.
            this.currentAction.body = mergeCollidingParts(this.currentAction.body, nonStaticParts);

            // Add to world
            Composite.add(engine.world, this.currentAction.body);

            // Reset currentAction
            this.inProgress = false;
            this.currentAction = { };
        }
    },
}

// Digit5: Joint
let NEW_JOINT = {
    matterOptions: {
        label: "joint",
        render: {
            strokeStyle: runner.enabled ? "#858585" : "#FFFFFF"
        }
    },

    inProgress: false,
    currentAction: { },

    // Create new constraint and add to world
    // The constraint is not attached to a body while the mouse is pressed. It
    // serves as a placeholder for the actual joint that is created when the
    // mouse is released.
    mousedown: function(event, engine, render) {
        this.inProgress = true;

        // Save starting position
        this.currentAction.position = Vector.create(
            render.mouse.position.x, render.mouse.position.y);

        // List of all bodies in the world
        this.currentAction.constraint = Constraint.create({...this.matterOptions,
            pointA: this.currentAction.position,
            pointB: render.mouse.position});

        // Add to world
        Composite.add(engine.world, this.currentAction.constraint);
    },

    // Replace constraint with new length
    mousemove: function(event, engine, render) {
        if (this.inProgress) {
            Composite.remove(engine.world, this.currentAction.constraint);

            this.currentAction.constraint = Constraint.create({...this.matterOptions,
                pointA: this.currentAction.position,
                pointB: render.mouse.position});

            // Add to world
            Composite.add(engine.world, this.currentAction.constraint);
        }
    },

    // Create actual joint attached to bodies
    mouseup: function(event, engine, render) {
        if (this.inProgress) {
            // Remove placeholder polygon
            Composite.remove(engine.world, this.currentAction.constraint);

            var allBodies = Composite.allBodies(engine.world);
            // Get bodies at end points of constraint
            var pointA = this.currentAction.position;
            var bodyA;
            // Do not put constraints on lemons (select first non-lemon
            // from list of objects at point)
            for (var body of Query.point(allBodies, pointA)) {
                if (body.label != "lemon") {
                    bodyA = body;
                    break;
                }
            }
            // If body is not null, calculate offset from centre
            if (bodyA) {
                pointA = Vector.sub(pointA, bodyA.position);
                // Snap to center if sufficiently close
                if (Vector.magnitude(pointA) < 10) {
                    pointA = Vector.create(0, 0);
                }
            }

            // Get bodies at end points of constraint
            var pointB = render.mouse.position;
            var bodyB;
            // Do not put constraints on lemons (select first non-lemon
            // from list of objects at point)
            // Do not select same body as bodyA
            for (var body of Query.point(allBodies, pointB)) {
                if (body.label != "lemon" && body !== bodyA) {
                    bodyB = body;
                    break;
                }
            }
            // If body is not null, calculate offset from centre
            if (bodyB) {
                pointB = Vector.sub(pointB, bodyB.position);
                // Snap to center if sufficiently close
                if (Vector.magnitude(pointB) < 10) {
                    pointB = Vector.create(0, 0);
                }
            }

            // Do not add to the world if:
            // - Both start and end of constraints are not a body
            // - Start and end are the same body
            if (bodyA && bodyB && bodyA !== bodyB) {
                this.currentAction.constraint = Constraint.create({...this.matterOptions,
                    bodyA: bodyA, bodyB: bodyB,
                    pointA: pointA, pointB: pointB});
                this.currentAction.constraint.label = this.label;
                Composite.add(engine.world, this.currentAction.constraint);
                constraints.push(this.currentAction.constraint);
            }

            // Reset currentAction
            this.inProgress = false;
            this.currentAction = { };
        }
    },
}

// Digit6: Spring
let NEW_SPRING = {
    ...NEW_JOINT,
    matterOptions: {
        label: "spring",
        stiffness: 0.03,
        render: {
            strokeStyle: runner.enabled ? "#858585" : "#FFFFFF"
        }
    },
};

// Digit7: Lemon
let NEW_LEMON = {
    radius: 16,
    sides: 24,

    matterOptions: {
        label: "lemon",
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
    },

    inProgress: false,
    currentAction: { },

    // Create new polygon and add to world
    // The polygon will be created static while the mouse is pressed
    // It serves as a placeholder for the actual lemon that is created when
    // the mouse is released
    mousedown: function(event, engine, render) {
        this.inProgress = true;

        // Save starting position
        this.currentAction.position = Vector.create(
            render.mouse.position.x, render.mouse.position.y);
        var radius = 16;

        // Create lemon with minimum radius as default
        this.currentAction.body = Bodies.polygon(
            render.mouse.position.x, render.mouse.position.y,
            this.sides, this.radius,
            {...this.matterOptions, isStatic: true}
        );

        // Add to world
        Composite.add(engine.world, this.currentAction.body);
    },

    // Move lemon to mouse position
    mousemove: function(event, engine, render) {
        if (this.inProgress) {
            Body.setPosition(this.currentAction.body, render.mouse.position);
        }
    },

    // Create actual lemon with correct physical properties
    mouseup: function(event, engine, render) {
        if (this.inProgress) {
            // Remove placeholder polygon
            Composite.remove(engine.world, this.currentAction.body);

            // Create actual lemon body
            // Cannot be static, override user option isStatic
            this.currentAction.body = Bodies.polygon(
                render.mouse.position.x, render.mouse.position.y,
                this.sides, this.radius,
                {...this.matterOptions, isStatic: false}
            );

            // Add to world
            Composite.add(engine.world, this.currentAction.body);
            lemons.push(this.currentAction.body);

            // Reset currentAction
            this.inProgress = false;
            this.currentAction = { };
        }
    },
}

// Digit8: Drag and delete
let DRAG = {
    inProgress: false,
    currentAction: { },

    // Select body to be moved
    // Make static while moved
    mousedown: function(event, engine, render) {
        this.inProgress = true;

        // List of all bodies in the world
        var allBodies = Composite.allBodies(engine.world);

        // Get bodies under mouse cursor
        var point = render.mouse.position;
        for (var body of Query.point(allBodies, point)) {
            // Do not drag or delete ground
            if (body.label != "ground") {
                this.currentAction.body = body;

                // Get list of attached constraints
                this.currentAction.constraints = constraints.filter((constraint) =>
                    constraint.bodyA === this.currentAction.body
                    || constraint.bodyB === this.currentAction.body
                );

                break;
            }
        }

        // If no body under mouse cursor, end mouse action
        if (!this.currentAction.body) {
            this.currentAction = { };
            this.inProgress = false;

        // On doubeclick: delete
        } else if (event.detail == 2) {
            // Remove body
            Composite.remove(engine.world, this.currentAction.body);
            // Remove from lists
            switch (this.currentAction.body.label) {
                case "wheel":
                    wheels = wheels.filter(
                        (other) => this.currentAction.body.parts.indexOf(other) < 0);
                    break;
                case "circle":
                case "plank":
                case "box":
                    nonStaticParts = nonStaticParts.filter(
                        (other) => this.currentAction.body.parts.indexOf(other) < 0);
                    break;
                case "lemon":
                    lemons = lemons.filter(
                        (other) => this.currentAction.body.parts.indexOf(other) < 0);
                    break;
            }

            // Remove constraints
            for (const constraint of this.currentAction.constraints) {
                Composite.remove(engine.world, constraint);
                // Remove from list
                constraints = constraints.filter((other) => other !== constraint);
            }

            // Reset mouse action
            this.currentAction = { };
            this.inProgress = false;

        } else {
            // Offset of object position from mouse
            this.currentAction.offset = Vector.sub(
                this.currentAction.body.position, render.mouse.position);

            // Make static while being moved
            // Reinstate on mouseup
            this.currentAction.isStatic = this.currentAction.body.isStatic;
            Body.setStatic(this.currentAction.body, true);
        }
    },

    // Set body position
    mousemove: function(event, engine, render) {
        if (this.inProgress) {
            var newPosition = Vector.add(render.mouse.position, this.currentAction.offset);
            Body.setPosition(this.currentAction.body, newPosition);
        }
    },

    // Release body
    // Reinstate former staticness
    mouseup: function(event, engine, render) {
        if (this.inProgress) {
            // If in drawing mode: Adjust length of constraints
            if (!runner.enabled) {
                for (const constraint of this.currentAction.constraints) {
                    if (constraint.length != 0) {
                        // Only adjust constraints of non-zero length, no pins
                        constraint.length = Constraint.currentLength(constraint);
                    } else {
                        console.log(constraint);
                        // For pins to the world, move the fixed point along
                        // with the constrained body
                        if (constraint.bodyA == null) {
                            constraint.pointA = Constraint.pointBWorld(constraint);
                        }
                        if (constraint.bodyB == null) {
                            constraint.pointB = Constraint.pointAWorld(constraint);
                        }
                    }
                }
            }

            // Reinstate "staticness"
            Body.setStatic(this.currentAction.body, this.currentAction.isStatic);

            // Reset currentAction
            this.inProgress = false;
            this.currentAction = { };
        }
    },
}

var mouseAction = NEW_WHEEL; // Default mouse action

////////////
// EVENTS //
////////////

// Add bodies on mouseclick
// On mousedown: create body at mouse position
addEventListener("mousedown", (e) => {
    if (e.which == 1) {
        mouseAction.mousedown(event, engine, render);
    }
});

// On mousemove
addEventListener("mousemove", (e) => {
    mouseAction.mousemove(event, engine, render);
});

// On mouseup
addEventListener("mouseup", (e) => {
    mouseAction.mouseup(event, engine, render);
});

// Turn wheels with left/right arrows
// Parameters for wheel torque depending on size
var torque = 0.2;
var responsiveness = 1;  // Determines the difference between small and large wheels (big number, small difference)
var maxVelocity = 0.5;

// Add to angular velocity
function turnWheel(wheel, torque, responsiveness, maxVelocity, direction) {
    var angularVelocity = Body.getAngularVelocity(wheel);
    // Only apply torque up to maxVelocity
    if (direction * angularVelocity < maxVelocity) {
        angularVelocity += direction * torque / (wheel.mass + responsiveness);
        angularVelocity = direction * Math.min(direction * angularVelocity, maxVelocity);
    }
    Body.setAngularVelocity(wheel, angularVelocity);
}

// Arrow keys: turn wheels
addEventListener("keydown", (e) => {
    // Do not turn wheels if engine is paused
    if (runner.enabled) {
        switch (e.code) {
            // Arrow keys: turn wheels
            case "ArrowLeft":
                for (let i = 0; i < wheels.length; i++) {
                    turnWheel(wheels[i], torque, responsiveness, maxVelocity, -1);
                }
                break;
            case "ArrowRight":
                for (let i = 0; i < wheels.length; i++) {
                    turnWheel(wheels[i], torque, responsiveness, maxVelocity, 1);
                }
                break;
        }
    }
});

// Spacebar: toggle simulation mode
var spacebarAllowed = true;  // To prevent repeat toggles when spacebar is held (event.repeat does not work)
addEventListener("keydown", (e) => {
    if (spacebarAllowed) {
        switch (e.code) {
            // Spacebar: toggle drawing/simulation mode
            // Pause the engine, change colour scheme
            case "Space":
                spacebarAllowed = false;

                runner.enabled = !runner.enabled;
                render.options.wireframes = !render.options.wireframes;
                render.options.showAxes = !render.options.showAxes;

                // Change colour of constraints
                var strokeStyle = runner.enabled ? "#858585" : "#FFFFFF";
                NEW_JOINT.matterOptions.render.strokeStyle = strokeStyle;
                NEW_SPRING.matterOptions.render.strokeStyle = strokeStyle;
                for (const constraint of constraints) {
                    constraint.render.strokeStyle = strokeStyle;
                }
                break;
        }
    }
});

addEventListener("keyup", (e) => {
    switch (e.code) {
        case "Space":
            spacebarAllowed = true;
            break;
    }
});

// Digits: Switch mouse action
addEventListener("keydown", (e) => {
    // Do not change while a body is created
    if (!mouseAction.inProgress) {
        switch (e.code) {
            // Number keys: change body type
            case "Digit1":
                mouseAction = NEW_WHEEL;
                break;
            case "Digit2":
                mouseAction = NEW_CIRCLE;
                break;
            case "Digit3":
                mouseAction = NEW_PLANK;
                break;
            case "Digit4":
                mouseAction = NEW_BOX;
                break;
            case "Digit5":
                mouseAction = NEW_JOINT;
                break;
            case "Digit6":
                mouseAction = NEW_SPRING;
                break;
            case "Digit7":
                mouseAction = NEW_LEMON;
                break;
            case "Digit8":
                mouseAction = DRAG;
                break;
        }
    }
});
