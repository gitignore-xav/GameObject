//#region Resources
const resources = {
	files: {
		maps: './resources/maps.json'
	},
	images: {
		placeholder: './resources/placeholder.jpg',
        marker: './resources/marker.png',
        hex: './resources/hex-grid.png'
	}
};

function loadResource(path) {
	return new Promise(resolve => {
		fetch(path).then(response => {
			resolve(response);
		});
	});
}

async function loadJson(path) {
    let value;
	await loadResource(path)
		.then(result => result.json())
		.then(data => {
            value = data;
            console.log("Loaded " + path);
        });

    return value;
}

async function loadImage(path) {
    let value;
	await loadResource(path)
		.then(result => {
            let img = new Image();
            img.src = path;//result.url;
            document.body.appendChild(img);

            value = img;
            console.log("Loaded " + path);
		});

    return value;
}


async function load() {
	for(const key in resources.files) {
		const path = resources.files[key];
		resources.files[key] = await loadJson(path);
	}

	for(const key in resources.images) {
		const path = resources.images[key];
		resources.images[key] = await loadImage(path);
	}
}
//#endregion

//#region Drawing
const Drawing = {}
Drawing.canvas = document.querySelector("canvas");
Drawing.canvas.width = 500;
Drawing.canvas.height = 500;

Drawing.ctx = Drawing.canvas.getContext('2d');

Drawing.clear = () => {
    const ctx = Drawing.ctx;
    ctx.clearRect(0, 0, 500, 500);
}
//#endregion

//#region Vectors
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    get magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    get direction() {
        return Math.atan2(this.y, this.x);
    }

    setMagnitude(magnitude) {
        const direction = this.direction;

        this.x = Math.cos(direction) * magnitude;
        this.y = Math.sin(direction) * magnitude;
        return this;
    }

    setDirection(direction) {
        const magnitude = this.magnitude;

        this.x = Math.cos(direction) * magnitude;
        this.y = Math.sin(direction) * magnitude;
        return this;
    }

    plus(vector) {
        return new Vector2(this.x + vector.x, this.y, + vector.y);
    }


    static get zero() {
        return new Vector2(0, 0);
    }
}
//#endregion

//#region Input 
class Input {
    static keys = new Map();
    static pressed = new Map();
    static released = new Map();
}

addEventListener('keydown', (e) => {
    Input.keys.set(e.key, true);
    Input.pressed.set(e.key, true);
});

addEventListener('keyup', (e) => {
    Input.keys.set(e.key, false);
    Input.released.set(e.key, true);
});
//#endregion

//#region World
class World {
    static time = 0;
    static timeScale = 1;

    static objects = [];
    static scenes = {};
    static scene;

    static addScene(name, scene) {
        if(!(scene instanceof Scene)) {
            console.error("Can only create a scene with constructor Scene!");
            return;
        }

        if(this.scenes.hasOwnProperty(name)) {
            console.error("Scene by that name already exists!");
            return;
        }

        this.scenes[name] = scene;
    }

    static destroyAll() {
        for(let i = World.objects.length - 1; i >= 0; i--) {
            if(World.objects[i].persist) continue;

            World.objects.splice(i, 1);
        }
    }

    // TODO Individual Scene resources
    // TODO Async Scene loading

    static async loadScene(sceneName) {
        if(!this.scenes.hasOwnProperty(sceneName)) {
            console.error("No scene by the name " + sceneName);
            return;
        }

        World.scene?.exit();

        World.destroyAll();
        console.log("loading scene " + sceneName);

        World.scene = World.scenes[sceneName];
        World.scene.enter();
    }

    static instantiate(object) {
        if(!(object instanceof GameObject)) {
            console.error("Can only Instantiate a GameObject or a class that extends GameObject!");
            return;
        }

        World.objects.push(object);
        object.start();

        return object;
    }

    static instantiateSingleton(object) {
        if(World.objects.find(o => o.constructor == object.constructor)) {
            return;
        }

        return World.instantiate(object);
    }

    static start() {
        const base = new Scene(() => {
            console.log("Base Scene Entered!");
        });

        World.addScene("Base", base);
    }
}

class Scene {
    constructor(enter, exit) {
        this.enter = enter ?? (() => {});
        this.exit = exit ?? (() => {});
    }
}
//#endregion

//#region Colliders
class Collider {
	type = Collider.Types.Default;
	static Types = {
		Default: 0x0001,
		Rectangle: 0x0002,
		Circle: 0x0004
	}
	constructor() {}

	toC(pos) { return { type: this.type, x: pos.x, y: pos.y } }
	toPolygon(pos) {
		return { points: [
			{ x: pos.x, y: pos.y }
		] }
	}
	
	collidesWith(ca, cb) {
		const a = this.type;
		const b = cb.type;

		switch(a | b) {
			case Collider.Types.Rectangle | Collider.Types.Rectangle:
				return Collider.AABB(ca, cb);

			case Collider.Types.Rectangle | Collider.Types.Circle:
				return Collider.AABBC(ca, cb);

			case Collider.Types.Circle | Collider.Types.Rectangle:
				return Collider.AABBC(cb, ca);

			case Collider.Types.Circle | Collider.Types.Circle:
				return Collider.CC(ca, cb);
			
			default:
				return false;
		}
	}

	static AABB(a, b) {
		return (a.x <= b.x + b.width) && 
			(a.x + a.width >= b.x) &&
			(a.y <= b.y + b.height) &&
			(a.y + a.height >= b.y);
	}

	static CC(a, b) {
		return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) <= a.radius + b.radius;
	}

	static AABBC(rect, circle) {
		let distX = Math.abs(circle.x - rect.x-rect.width/2);
		let distY = Math.abs(circle.y - rect.y-rect.height/2);

		if(distX > (rect.width/2 + circle.radius)) return false;
		if(distY > (rect.height/2 + circle.radius)) return false;

		if(distX <= (rect.width/2)) return true;
		if(distY <= (rect.height/2)) return true;

		let dx = distX - rect.width/2;
		let dy = distY - rect.height/2;
		return (dx**2 + dy**2 <= (circle.radius));
	}
}

class Rectangle extends Collider {
	type = Collider.Types.Rectangle;
	constructor(width, height) {
		super();
		
		this.width = width ?? 25;
		this.height = height ?? 25;
	}

	toC(pos) { 
		return { 
			type: this.type,
			x: pos.x, 
			y: pos.y,
			width: pos.w,
			height: pos.h
		};
	}
}

class Circle extends Collider {
	type = Collider.Types.Circle;
	constructor(radius) {
		super();
		
		this.radius = radius ?? 12.5;
	}

	toC(pos) { 
		return { 
			type: this.type,
			x: pos.x, 
			y: pos.y,
			radius: this.radius
		};
	}
}
//#endregion

//#region GameObjects
class GameObject {
    persist = false;
    collider = new Circle(10);
    killed = false;
    fill = "#ff0000";
    #id = self.crypto.randomUUID();
    z = 1;

    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    get id() {
        return this.id;
    }

    destroy() {
        this.killed = true;
        return this;
    }


    start() {}

    update() {}

    draw() {
        const ctx = Drawing.ctx;

        ctx.beginPath();
        ctx.fillStyle = this.fill;
        ctx.arc(this.x, this.y, 7, 0, Math.PI*2);
        ctx.fill();
    }
}
//#endregion

//#region Easing
function easeOutExpo(k) {
    return k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
}
//#endregion

//#region Scenes
World.addScene("Game", new Scene(() => {
    // TODO Set up the game
    // [ ] Read map data from json file
    // [ ] Level select screen, etc.
    // [ ] Better Graphics
    // [ ] Screen shaking
    // [x] Ball/Saw Collisions
    // [x] in-game Button to start saw spawner
    // [x] Saw spawner
    // [ ] Game Manager to keep track of score, lives, etc.

    World.instantiate(new GameManager());

    World.instantiate(new Player(350, 270));
    World.instantiate(new Ball(250, 250));

    World.instantiate(new Spawner(150, 250));

    World.instantiate(new Wall(300, 120, 70, 60));
    World.instantiate(new Wall(110, 305, 60, 70));
}));
//#endregion

//#region Game Systems

class Player extends GameObject {
    velocity = Vector2.zero;
    accel = Vector2.zero;
    z = 3;
    r = 11;
    collider = new Circle(this.r);

    speed = 2;
    friction = 0.7;
    cooldown = 0;
    cooldownTime = 0.6;

    constructor(x, y) {
        super(x, y);

        this.popups = [
            World.instantiate(new Popup(this.x + 10, this.y, "Arrow Keys to Move", 14, 12)),
            World.instantiate(new Popup(this.x, this.y - 15, "Player", 17, 10))
        ];
    }

    ballCollisions() {
        let balls = World.objects.filter(o => (o instanceof Ball) && 
            (this.collider.collidesWith(this.collider.toC(this), o.collider.toC(o)))
        );

        balls.forEach(ball => {
            let sqrDist = (this.x - ball.x) ** 2 + (this.y - ball.y) ** 2;
            let dist = Math.sqrt(sqrDist);
            let angle = Math.atan2(this.y - ball.y, this.x - ball.x);

            let v1 = Vector2.zero
                .setMagnitude((this.velocity.magnitude + this.accel.magnitude) + (ball.velocity.magnitude - ball.accel.magnitude) * ball.mass)
                .setDirection(angle);

            let v2 = Vector2.zero
                .setMagnitude((this.velocity.magnitude + this.accel.magnitude) + (ball.velocity.magnitude - ball.accel.magnitude))
                .setDirection(angle);

            ball.addOppForce(v2);
            ball.scoreMode = ball.scoreTime;

            this.accel.x += v1.x;
            this.accel.y += v1.y;
            this.cooldown = this.cooldownTime;
        });
    }

    enemyCollisions() {
        let balls = World.objects.filter(o => (o instanceof Saw) && 
            (o.wait <= 0) &&
            (this.collider.collidesWith(this.collider.toC(this), o.collider.toC(o)))
        );

        balls.forEach(ball => {
            // TODO Player Death
            // [ ] Blood splash effect
            // [ ] particles
            // [ ] Restart after x amount of time

            //this.destroy();
        });
    }

    spawnerCollisions() {
        let spawners = World.objects.filter(o => (o instanceof Spawner) &&
            (!o.started) &&
            (this.collider.collidesWith(this.collider.toC(this), o.collider.toC(o)))
        );

        spawners.forEach(spawner => {
            console.log("E");
            spawner.started = true;
        });
    }

    wallCollisions() {
        let walls = World.objects.filter(o => (o instanceof Wall) && 
            (o.collider.collidesWith(o.collider.toC(o), this.collider.toC(this)))
        );

        walls.forEach(wall => {
            let v = new Vector2(
                this.x - wall.center.x,
                this.y - wall.center.y
            )

            if(Math.abs(v.y / wall.collider.height) > Math.abs(v.x / wall.collider.width)) {
				if(v.y > 0) {
					// down
					this.velocity.y = 0;
					this.y = wall.y + wall.h + this.r;
				} else {
					// up
					this.velocity.y = 0;
					this.y = wall.y - this.r;
				}
			} else {
				if(v.x > 0) {
					// right
					this.velocity.x = 0;
					this.x = wall.x + wall.w + this.r;
				} else {
					// left
					this.velocity.x = 0;
					this.x = wall.x - this.r;
				}
			}
        });
    }

    edgeCollisions() {
        if(this.x - this.r < 0) {
            this.x = this.r;
        } 

        if(this.x + this.r > 500) {
            this.x = 500 - this.r;
        }

        if(this.y - this.r < 0) {
            this.y = this.r;
        } 

        if(this.y + this.r > 500) {
            this.y = 500 - this.r;
        }
    }

    addForce(vector) {
        this.accel.x += vector.x;
        this.accel.y += vector.y;
    }

    prev = Date.now();
    update() {
        const delta = (Date.now() - this.prev) / 1000;
        this.prev = Date.now();
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;


        const horizontal = (Input.keys.get("ArrowRight") ? 1 : 0) + (Input.keys.get("ArrowLeft") ? -1 : 0);
        const vertical = (Input.keys.get("ArrowDown") ? 1 : 0) + (Input.keys.get("ArrowUp") ? -1 : 0);

        let speed = (this.speed + (0 - this.speed) * (this.cooldown/this.cooldownTime));
        this.addForce(new Vector2(horizontal * speed, vertical * speed));
        
        this.cooldown -= delta;
        if(this.cooldown <= 0)
            this.cooldown = 0;
        
        this.ballCollisions();
        this.enemyCollisions();
        this.spawnerCollisions();
        
        this.velocity.x += this.accel.x * World.timeScale;
        this.velocity.y += this.accel.y * World.timeScale;
        
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        this.wallCollisions();
        this.edgeCollisions();

        this.accel.setMagnitude(0);

        for(let i = this.popups.length - 1; i >= 0; i--) {
            if(this.popups[i].killed) {
                this.popups.splice(i, 1);
                continue;
            }
        }
    }

    draw() {
        const ctx = Drawing.ctx;

        ctx.fillStyle = "#6e6e6e";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fill();
    }
}

class Ball extends GameObject {
    velocity = Vector2.zero;
    accel = Vector2.zero;
    z = 2;
    r = 20;
    collider = new Circle(this.r);

    speed = 2;
    boostSpeed = 5;
    mass = 2;
    started = false;
    scoreMode = 0;
    scoreTime = 1;

    constructor(x, y) {
        super(x, y);

        this.popups = [
            World.instantiate(new Popup(this.x + this.r, this.y, "Ball", 14, 12)),
        ];
    }

    wallCollisions() {
        let walls = World.objects.filter(o => (o instanceof Wall) && 
            (o.collider.collidesWith(o.collider.toC(o), this.collider.toC(this)))
        );

        walls.forEach(wall => {
            let v = new Vector2(
                this.x - wall.center.x,
                this.y - wall.center.y
            )

            if(Math.abs(v.y / wall.collider.height) > Math.abs(v.x / wall.collider.width)) {
				if(v.y > 0) {
					// down
                    this.acc
					this.y = wall.y + wall.h + this.r;
				} else {
					// up
					this.y = wall.y - this.r;
				}

                this.addForce(new Vector2(0, (-this.velocity.y - this.accel.y) * 2 * this.mass));
			} else {
				if(v.x > 0) {
					// right
					this.x = wall.x + wall.w + this.r;
				} else {
					// left
					this.x = wall.x - this.r;
				}

                this.addForce(new Vector2((-this.velocity.x - this.accel.x) * 2 * this.mass, 0));
			}
        });
    }

    edgeCollisions() {
        if(this.x - this.r < 0) {
            this.x = this.r;
            this.addForce(new Vector2((-this.velocity.x - this.accel.x) * 2 * this.mass, 0));
        } 

        if(this.x + this.r > 500) {
            this.x = 500 - this.r;
            this.addForce(new Vector2((-this.velocity.x - this.accel.x) * 2 * this.mass, 0));
        }

        if(this.y - this.r < 0) {
            this.y = this.r;
            this.addForce(new Vector2(0, (-this.velocity.y - this.accel.y) * 2 * this.mass));
        } 

        if(this.y + this.r > 500) {
            this.y = 500 - this.r;
            this.addForce(new Vector2(0, (-this.velocity.y - this.accel.y) * 2 * this.mass));
        }
    }

    enemyCollisions() {
        if(this.scoreMode <= 0) return;

        let balls = World.objects.filter(o => (o instanceof Saw) && 
            (o.wait <= 0) &&
            (this.collider.collidesWith(this.collider.toC(this), o.collider.toC(o)))
        );

        balls.forEach(ball => {
            // TODO Point Score
            // [ ] Cool VFX
            // [x] Score point

            GameManager.main?.scorePoint();
            World.instantiate(new Popup(ball.x, ball.y, "Points " + GameManager.main.points, 16, 12));

            ball.destroy();
        });
    }

    addForce(vector) {
        this.started = true;
        this.accel.x += vector.x / this.mass;
        this.accel.y += vector.y / this.mass;
    }

    addOppForce(vector) {
        this.started = true;
        this.accel.x -= vector.x / this.mass;
        this.accel.y -= vector.y / this.mass;
    }

    prev = Date.now();
    update() {
        const delta = (Date.now() - this.prev) / 1000;
        this.prev = Date.now();

        this.scoreMode -= delta;
        if(this.scoreMode <= 0) {
            this.scoreMode = 0;
        }

        this.wallCollisions();
        this.edgeCollisions();
        this.enemyCollisions();

        this.velocity.x += this.accel.x;
        this.velocity.y += this.accel.y;

        if(this.started)
            this.velocity.setMagnitude(this.speed + (this.boostSpeed - this.speed) * (this.scoreMode/this.scoreTime));

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        this.accel.setMagnitude(0);

        for(let i = this.popups.length - 1; i >= 0; i--) {
            if(this.popups[i].killed) {
                this.popups.splice(i, 1);
                continue;
            }
        }
    }

    draw() {
        const ctx = Drawing.ctx;

        ctx.fillStyle = this.scoreMode > 0 ? "#2376a9" : "#000000";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fill();
    }
}

class Saw extends GameObject {
    velocity = Vector2.zero;
    accel = Vector2.zero;
    z = 2;
    r = 13;
    collider = new Circle(this.r);

    speed = 5;
    mass = 2;
    wait = 3;

    constructor(x, y) {
        super(x, y);
    }

    wallCollisions() {
        let walls = World.objects.filter(o => (o instanceof Wall) && 
            (o.collider.collidesWith(o.collider.toC(o), this.collider.toC(this)))
        );

        walls.forEach(wall => {
            let v = new Vector2(
                this.x - wall.center.x,
                this.y - wall.center.y
            )

            if(Math.abs(v.y / wall.collider.height) > Math.abs(v.x / wall.collider.width)) {
				if(v.y > 0) {
					// down
                    this.acc
					this.y = wall.y + wall.h + this.r;
				} else {
					// up
					this.y = wall.y - this.r;
				}

                this.addForce(new Vector2(0, (-this.velocity.y - this.accel.y) * 2 * this.mass));
			} else {
				if(v.x > 0) {
					// right
					this.x = wall.x + wall.w + this.r;
				} else {
					// left
					this.x = wall.x - this.r;
				}

                this.addForce(new Vector2((-this.velocity.x - this.accel.x) * 2 * this.mass, 0));
			}
        });
    }

    edgeCollisions() {
        if(this.x - this.r < 0) {
            this.x = this.r;
            this.addForce(new Vector2((-this.velocity.x - this.accel.x) * 2 * this.mass, 0));
        } 

        if(this.x + this.r > 500) {
            this.x = 500 - this.r;
            this.addForce(new Vector2((-this.velocity.x - this.accel.x) * 2 * this.mass, 0));
        }

        if(this.y - this.r < 0) {
            this.y = this.r;
            this.addForce(new Vector2(0, (-this.velocity.y - this.accel.y) * 2 * this.mass));
        } 

        if(this.y + this.r > 500) {
            this.y = 500 - this.r;
            this.addForce(new Vector2(0, (-this.velocity.y - this.accel.y) * 2 * this.mass));
        }
    }


    addForce(vector) {
        this.started = true;
        this.accel.x += vector.x / this.mass;
        this.accel.y += vector.y / this.mass;
    }

    addOppForce(vector) {
        this.started = true;
        this.accel.x -= vector.x / this.mass;
        this.accel.y -= vector.y / this.mass;
    }

    start() {
        // TODO set a random velocity
        this.addForce(new Vector2(3, 7));
    }

    prev = Date.now();
    update() {
        const delta = (Date.now() - this.prev) / 1000;
        this.prev = Date.now();

        if(this.wait > 0) {
            this.wait -= delta;
            return;
        }

        this.wallCollisions();
        this.edgeCollisions();

        this.velocity.x += this.accel.x;
        this.velocity.y += this.accel.y;
            
        this.velocity.setMagnitude(this.speed);

        this.x += this.velocity.x;
        this.y += this.velocity.y;

        this.accel.setMagnitude(0);
    }

    draw() {
        const ctx = Drawing.ctx;

        ctx.fillStyle = this.wait > 0 ? "rgba(218, 98, 98, 0.8)" :"#f94343";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
        ctx.fill();
    }
}

class Wall extends GameObject {
    constructor(x, y, w, h) {
        super(x, y);

        this.w = w;
        this.h = h;

        this.collider = new Rectangle(w, h);
    }

    draw() {
        const ctx = Drawing.ctx;
        
        ctx.fillStyle = "#000000";
        ctx.fillRect(this.x, this.y, this.w, this.h);
    }

    get center() {
		return { 
			x: this.x + this.w/2, 
			y: this.y + this.h/2
		}
	}
}

class GameManager extends GameObject {
    points = 0;
    lives = 3;
    constructor() {
        super();
    }

    start() {
        World.instantiate(new Popup(20, 30, "Game Started!", 16, 5));
    }

    scorePoint() {
        // TODO Score points 
        // [ ] GUI VFX
        // [x] Add to points

        this.points++;
    }

    // TODO Display
    // [ ] Show Points
    // [ ] Show Lives
    // [ ] Manage Lives
    // [ ] Manage Combos
    // [ ] Show Combos
    // [ ] Apply Combo Boosts
    // [ ] Put a floating arrow above the spawner before it starts

    static get main() {
        return World.objects.find(o => o instanceof GameManager);
    }
}

class Spawner extends GameObject {
    started = false;
    prev = Date.now();
    interval = 0;
    z = 0;
    collider = new Circle(7); // [ ] COllide with the player to start
    constructor(x, y) {
        super(x, y);

        this.popups = [
            World.instantiate(new Popup(this.x + 5, this.y, "Saw Spawner", 14, 12)),
        ];
    }

    update() {
        if(!this.started) return;

        const delta = (Date.now() - this.prev) / 1000;
        this.prev = Date.now();

        this.interval -= delta;
        if(this.interval <= 0) {
            World.instantiate(new Saw(150, 250));
            this.interval = 3;
        }

        for(let i = this.popups.length - 1; i >= 0; i--) {
            if(this.popups[i].killed) {
                this.popups.splice(i, 1);
                continue;
            }
        }
    }
}

class Popup extends GameObject {
    time = 0;
    prev = 0;
    stage = 0;

    flickering = 0.2;
    tick = 0;
    intv = 0.07;

    bgAlpha = 0.8;
    reached = false;

    w = 0;
    elapsed = 0;

    fade = 3;
    z = 40;

    constructor(x, y, text, size, m) {
        super(x, y);
        this.text = text ?? "Sample";

        this.prev = Date.now();
        this.size = size ?? 25;
        this.fadeMultiplier = m ?? 1;
    }

    draw() {
        const delta = (Date.now() - this.prev) / 1000;
        this.prev = Date.now();

        this.elapsed += delta;
        
        const ctx = Drawing.ctx;

        ctx.font = `${this.size}px Trebuchet MS`;
        const rect = ctx.measureText(" " + this.text);


        if(this.flickering > 0) {
            this.flickering -= delta;
            this.tick += delta;
            if(this.tick > this.intv) {
                if (this.tick > this.intv*2) this.tick = 0;
                return;
            }
        } else if(this.bgAlpha > 0) {
            this.w += 5 * delta;
            if(this.w >= 1) {
                this.w = 1;

                this.bgAlpha -= delta;
                this.bgAlpha = this.reached ? 0 : Math.max(Math.min(this.bgAlpha, 1), 0);
                if(this.bgAlpha <= 0) {
                    this.reached = true;
                }
            }
            ctx.beginPath();
            ctx.globalAlpha = this.bgAlpha;
            ctx.fillStyle = ctx.createPattern(resources.images.hex, "repeat");
            ctx.fillRect(this.x - this.size/2+2, this.y - this.size/2+2, this.size+2 + rect.actualBoundingBoxRight, this.size+2);
            ctx.globalAlpha = 1;
            

           
            if(this.w >= 1) {
                ctx.globalAlpha = this.bgAlpha;
            }
            ctx.fillStyle = "#ff0000";
            ctx.filter = `blur(${15 + (8 - 15) * this.w}px)`;
            ctx.fillRect(this.x - this.size/2, this.y - this.size/2, 0 + ((this.size + rect.actualBoundingBoxRight) + 0) * easeOutExpo(this.w), this.size);
            ctx.globalAlpha = 1;
        } else {
            this.fade -= this.fadeMultiplier * delta;
            if(this.fade <= 0) {
                this.fade = 0;
                this.destroy();
            }
        }

        ctx.globalAlpha = this.fade;
        ctx.filter = "none";
        ctx.fillStyle = "#ff0000";

        ctx.drawImage(resources.images.marker, this.x - this.size/2, this.y - this.size/2, this.size, this.size);

        ctx.strokeStyle = "#ff0000";
        ctx.strokeWeight = 4;
        ctx.fillText(" " + this.text, this.x + this.size/2, this.y + rect.actualBoundingBoxAscent/2);
        ctx.strokeText(" " + this.text, this.x + this.size/2, this.y + rect.actualBoundingBoxAscent/2);
        ctx.globalAlpha = 1;
    }
}

//#endregion