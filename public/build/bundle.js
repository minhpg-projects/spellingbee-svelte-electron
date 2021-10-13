
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.19.1' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const { dialog } = require('electron').remote;
    const fs = require('fs');

    const loadFile = () => {
        return dialog.showOpenDialog({properties: ['openFile'],filters: [
            {name: 'Text', extensions: ['txt']}
        ] }).then(async (response) => {
            if (!response.canceled) {
               const data = await fs.promises.readFile(response.filePaths[0]);
               return data.toString().trim().split('\n')
            } else {
              console.log("no file selected");
            }
        });
    };

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const COUNTDOWN_FROM = 10 * 1000;

    const formatter = new Intl.DateTimeFormat("en", {
      hour12: false,
      minute: "2-digit",
      second: "2-digit"
    });

    const time = writable(formatter.format(COUNTDOWN_FROM));
    const isRunning = writable(false);
    const isComplete = writable(false);

    const createTimer = () => {
      let animationRef;
      let latestStartTime;
      let remainingTime = COUNTDOWN_FROM;

      const animate = timestamp => {
        // is it the first iteration in this cycle?
        if (latestStartTime === undefined) {
          // make a note of the start time
          latestStartTime = timestamp + remainingTime;
        }
        console.log(timestamp, latestStartTime);

        // the time to display now
        const currentTime = latestStartTime - timestamp;
        if (currentTime <= 0) {
          cancelAnimationFrame(animationRef);
          time.set(formatter.format(0));
          isRunning.set(false);
          isComplete.set(true);
          return;
        }
        time.set(formatter.format(currentTime));

        // keep animating recursively
        animationRef = requestAnimationFrame(animate);
      };

      const api = {
        start: () => {
          isRunning.set(true);
          animationRef = requestAnimationFrame(animate);
        },

        pause: () => {
          cancelAnimationFrame(animationRef);
          if (latestStartTime !== undefined) {
            // prepare for the next cycle
            remainingTime = latestStartTime - performance.now();
            latestStartTime = undefined;
          }
          isRunning.set(false);
        },

        reset: Function.prototype
      };

      return api;
    };

    const timer = createTimer();

    /* src/components/card.svelte generated by Svelte v3.19.1 */
    const file = "src/components/card.svelte";

    // (71:8) {#if loaded}
    function create_if_block_2(ctx) {
    	let a0;
    	let i0;
    	let t0;
    	let a1;
    	let i1;
    	let t1;
    	let a2;
    	let i2;
    	let t2;
    	let a3;
    	let i3;
    	let t3;
    	let a4;
    	let i4;
    	let dispose;

    	const block = {
    		c: function create() {
    			a0 = element("a");
    			i0 = element("i");
    			t0 = space();
    			a1 = element("a");
    			i1 = element("i");
    			t1 = space();
    			a2 = element("a");
    			i2 = element("i");
    			t2 = space();
    			a3 = element("a");
    			i3 = element("i");
    			t3 = space();
    			a4 = element("a");
    			i4 = element("i");
    			attr_dev(i0, "class", "fa fa-chevron-left svelte-ufzekz");
    			add_location(i0, file, 72, 12, 1689);
    			attr_dev(a0, "class", "navbar-item svelte-ufzekz");
    			add_location(a0, file, 71, 8, 1621);
    			attr_dev(i1, "class", "fa fa-chevron-right svelte-ufzekz");
    			add_location(i1, file, 75, 12, 1810);
    			attr_dev(a1, "class", "navbar-item svelte-ufzekz");
    			add_location(a1, file, 74, 8, 1743);
    			attr_dev(i2, "class", "fa fa-undo svelte-ufzekz");
    			add_location(i2, file, 78, 12, 1930);
    			attr_dev(a2, "class", "navbar-item svelte-ufzekz");
    			add_location(a2, file, 77, 8, 1865);
    			attr_dev(i3, "class", "fa fa-flag svelte-ufzekz");
    			add_location(i3, file, 82, 12, 2043);
    			attr_dev(a3, "class", "navbar-item svelte-ufzekz");
    			add_location(a3, file, 81, 8, 1977);
    			attr_dev(i4, "class", "fa fa-ban svelte-ufzekz");
    			add_location(i4, file, 85, 12, 2154);
    			attr_dev(a4, "class", "navbar-item svelte-ufzekz");
    			add_location(a4, file, 84, 8, 2089);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a0, anchor);
    			append_dev(a0, i0);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, a1, anchor);
    			append_dev(a1, i1);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, a2, anchor);
    			append_dev(a2, i2);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, a3, anchor);
    			append_dev(a3, i3);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, a4, anchor);
    			append_dev(a4, i4);

    			dispose = [
    				listen_dev(a0, "click", /*click_handler*/ ctx[13], false, false, false),
    				listen_dev(a1, "click", /*click_handler_1*/ ctx[14], false, false, false),
    				listen_dev(a2, "click", /*click_handler_2*/ ctx[15], false, false, false),
    				listen_dev(a3, "click", /*click_handler_3*/ ctx[16], false, false, false),
    				listen_dev(a4, "click", /*click_handler_4*/ ctx[17], false, false, false)
    			];
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(a2);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(a3);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(a4);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(71:8) {#if loaded}",
    		ctx
    	});

    	return block;
    }

    // (92:8) {#if loaded}
    function create_if_block_1(ctx) {
    	let h1;
    	let t0_value = /*words*/ ctx[0].length + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = text(" words loaded!");
    			attr_dev(h1, "class", "navbar-item svelte-ufzekz");
    			add_location(h1, file, 92, 12, 2359);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*words*/ 1 && t0_value !== (t0_value = /*words*/ ctx[0].length + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(92:8) {#if loaded}",
    		ctx
    	});

    	return block;
    }

    // (108:12) {:else}
    function create_else_block(ctx) {
    	let h1;
    	let t;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t = text(/*$time*/ ctx[3]);
    			attr_dev(h1, "class", "title svelte-ufzekz");
    			add_location(h1, file, 108, 12, 2778);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$time*/ 8) set_data_dev(t, /*$time*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(108:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (106:12) {#if isComplete}
    function create_if_block(ctx) {
    	let h1;
    	let t;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t = text(/*word*/ ctx[1]);
    			attr_dev(h1, "class", "title svelte-ufzekz");
    			add_location(h1, file, 106, 12, 2716);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*word*/ 2) set_data_dev(t, /*word*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(106:12) {#if isComplete}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let nav;
    	let div1;
    	let div0;
    	let img;
    	let img_src_value;
    	let t0;
    	let t1;
    	let a;
    	let i;
    	let t2;
    	let t3;
    	let section;
    	let div3;
    	let div2;
    	let section_class_value;
    	let dispose;
    	let if_block0 = /*loaded*/ ctx[2] && create_if_block_2(ctx);
    	let if_block1 = /*loaded*/ ctx[2] && create_if_block_1(ctx);

    	function select_block_type(ctx, dirty) {
    		if (isComplete) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type();
    	let if_block2 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div1 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			if (if_block0) if_block0.c();
    			t1 = space();
    			a = element("a");
    			i = element("i");
    			t2 = space();
    			if (if_block1) if_block1.c();
    			t3 = space();
    			section = element("section");
    			div3 = element("div");
    			div2 = element("div");
    			if_block2.c();
    			if (img.src !== (img_src_value = "isv_logo.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "svelte-ufzekz");
    			add_location(img, file, 68, 12, 1550);
    			attr_dev(div0, "class", "navbar-item svelte-ufzekz");
    			add_location(div0, file, 67, 8, 1512);
    			attr_dev(i, "class", "fa fa-folder-open svelte-ufzekz");
    			add_location(i, file, 89, 12, 2281);
    			attr_dev(a, "class", "navbar-item svelte-ufzekz");
    			add_location(a, file, 88, 8, 2213);
    			attr_dev(div1, "class", "navbar-brand svelte-ufzekz");
    			add_location(div1, file, 66, 4, 1477);
    			attr_dev(nav, "class", "navbar is-black svelte-ufzekz");
    			add_location(nav, file, 65, 0, 1443);
    			attr_dev(div2, "class", "is-align-self-center svelte-ufzekz");
    			add_location(div2, file, 104, 8, 2640);
    			attr_dev(div3, "class", "hero-body columns is-desktop is-vcentered is-centered svelte-ufzekz");
    			add_location(div3, file, 103, 4, 2564);
    			attr_dev(section, "class", section_class_value = "hero\n    is-" + (isComplete ? "danger" : "success") + "\n    is-fullheight-with-navbar\n    " + " svelte-ufzekz");
    			add_location(section, file, 97, 0, 2450);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, nav, anchor);
    			append_dev(nav, div1);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(div1, t0);
    			if (if_block0) if_block0.m(div1, null);
    			append_dev(div1, t1);
    			append_dev(div1, a);
    			append_dev(a, i);
    			append_dev(div1, t2);
    			if (if_block1) if_block1.m(div1, null);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, section, anchor);
    			append_dev(section, div3);
    			append_dev(div3, div2);
    			if_block2.m(div2, null);
    			dispose = listen_dev(a, "click", /*click_handler_5*/ ctx[18], false, false, false);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*loaded*/ ctx[2]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div1, t1);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*loaded*/ ctx[2]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if_block2.p(ctx, dirty);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(section);
    			if_block2.d();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $time;
    	validate_store(time, "time");
    	component_subscribe($$self, time, $$value => $$invalidate(3, $time = $$value));
    	const msg = new SpeechSynthesisUtterance();
    	msg.voiceURI = "native";
    	msg.volume = 1; // 0 to 1
    	msg.rate = 1; // 0.1 to 10
    	msg.lang = "en-US";

    	const speak = text => {
    		msg.text = text;
    		speechSynthesis.speak(msg);
    	};

    	let words = [];
    	let word_count = 0;

    	const forwardWord = () => {
    		timer.reset();

    		if (word_count < words.length - 1) {
    			$$invalidate(11, word_count += 1);
    		} else {
    			$$invalidate(11, word_count = 0);
    		}
    	};

    	const backwardWord = () => {
    		timer.reset();

    		if (word_count > 0) {
    			$$invalidate(11, word_count -= 1);
    		} else {
    			$$invalidate(11, word_count = words.length - 1);
    		}
    	};

    	const resetWord = () => {
    		timer.reset();
    		$$invalidate(11, word_count = 0);
    	};

    	const loadWordList = async () => {
    		$$invalidate(0, words = await loadFile());

    		if (words) {
    			$$invalidate(2, loaded = true);
    			timer.reset();
    		}
    	};

    	const startTimer = () => {
    		if (isComplete) {
    			forwardWord();
    		}

    		timer.reset();
    		timer.start();
    	};

    	const stopTimer = () => {
    		timer.pause();
    	};

    	const click_handler = () => backwardWord();
    	const click_handler_1 = () => forwardWord();
    	const click_handler_2 = () => resetWord();
    	const click_handler_3 = () => startTimer();
    	const click_handler_4 = () => stopTimer();
    	const click_handler_5 = () => loadWordList();

    	$$self.$capture_state = () => ({
    		msg,
    		speak,
    		loadFile,
    		timer,
    		isRunning,
    		isComplete,
    		time,
    		words,
    		word_count,
    		forwardWord,
    		backwardWord,
    		resetWord,
    		loadWordList,
    		startTimer,
    		stopTimer,
    		SpeechSynthesisUtterance,
    		speechSynthesis,
    		word,
    		loaded,
    		$time
    	});

    	$$self.$inject_state = $$props => {
    		if ("words" in $$props) $$invalidate(0, words = $$props.words);
    		if ("word_count" in $$props) $$invalidate(11, word_count = $$props.word_count);
    		if ("word" in $$props) $$invalidate(1, word = $$props.word);
    		if ("loaded" in $$props) $$invalidate(2, loaded = $$props.loaded);
    	};

    	let word;
    	let loaded;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*words, word_count*/ 2049) {
    			 $$invalidate(1, word = words[word_count] || "please load a word list!"); //`${word_count}. ${words[word_count]}`;
    		}
    	};

    	 $$invalidate(2, loaded = false);

    	return [
    		words,
    		word,
    		loaded,
    		$time,
    		forwardWord,
    		backwardWord,
    		resetWord,
    		loadWordList,
    		startTimer,
    		stopTimer,
    		msg,
    		word_count,
    		speak,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5
    	];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.19.1 */
    const file$1 = "src/App.svelte";

    function create_fragment$1(ctx) {
    	let main;
    	let current;
    	const card = new Card({ $$inline: true });

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(card.$$.fragment);
    			attr_dev(main, "class", "svelte-1prv04f");
    			add_location(main, file$1, 5, 0, 83);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(card, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(card);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { name } = $$props;
    	const writable_props = ["name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ name, Card });

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(0, name = $$props.name);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !("name" in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: require("os").userInfo().username
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
