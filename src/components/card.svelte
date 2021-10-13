<script>
    const msg = new SpeechSynthesisUtterance();
    msg.voiceURI = "native";
    msg.volume = 1; // 0 to 1
    msg.rate = 1; // 0.1 to 10
    msg.lang = "en-US";
    const speak = (text) => {
        msg.text = text;
        speechSynthesis.speak(msg);
    };

    import loadFile from "../loadFile";
    import {
        timer,
        isRunning,
        isComplete,
        time,
    } from "../store/countdownTimer";

    let words = [];
    let word_count = 0;
    $: word = words[word_count] || "please load a word list!"; //`${word_count}. ${words[word_count]}`;
    $: loaded = false
    const forwardWord = () => {
        timer.reset()
        if (word_count < words.length - 1) {
            word_count += 1;
        } else {
            word_count = 0;
        }
    };
    const backwardWord = () => {
        timer.reset()
        if (word_count > 0) {
            word_count -= 1;
        } else {
            word_count = words.length - 1;
        }
    };
    const resetWord = () => {
        timer.reset()
        word_count = 0;
    };

    const loadWordList = async () => {
        words = await loadFile();
        if(words) {
            loaded = true
            timer.reset()
        }
    };
    const startTimer = () => {
        if(isComplete){
            forwardWord()
        }
        timer.reset()
        timer.start();
    };

    const stopTimer = () => {
        timer.pause();
    };

</script>

<nav class="navbar is-black">
    <div class="navbar-brand">
        <div class="navbar-item">
            <img src="isv_logo.png" />
        </div>
        {#if loaded}
        <a on:click={() => backwardWord()} class="navbar-item">
            <i class="fa fa-chevron-left" />
        </a>
        <a on:click={() => forwardWord()} class="navbar-item">
            <i class="fa fa-chevron-right" />
        </a>
        <a on:click={() => resetWord()} class="navbar-item">
            <i class="fa fa-undo" />
        </a>

        <a on:click={() => startTimer()} class="navbar-item">
            <i class="fa fa-flag" />
        </a>
        <a on:click={() => stopTimer()} class="navbar-item">
            <i class="fa fa-ban" />
        </a>
        {/if}
        <a on:click={() => loadWordList()} class="navbar-item">
            <i class="fa fa-folder-open" />
        </a>
        {#if loaded}
            <h1 class="navbar-item">{words.length} words loaded!</h1>
        {/if}
    </div>
</nav>

<section
    class=
    "hero
    is-{isComplete ? 'danger' : 'success'}
    is-fullheight-with-navbar
    ">
    <div class="hero-body columns is-desktop is-vcentered is-centered">
        <div class="is-align-self-center">
            {#if isComplete}
            <h1 class="title">{word}</h1>
            {:else}
            <h1 class="title">{$time}</h1>
            {/if}
        </div>
    </div>
</section>

<style>
    * {
        user-select: none;
        -moz-user-select: none;
        -webkit-user-select: none;
        -ms-user-select: none;
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
    }
</style>
