<script lang="ts">
    import { afterUpdate, tick } from "svelte";
    import {
        chatMessages,
        chatLoading,
        chatExpanded,
        sendMessage,
    } from "$lib/stores/tutor.store";

    let input = "";
    let messagesEl: HTMLDivElement;
    let shouldScroll = false;

    // Only scroll after an update if flagged (set in sendMessage)
    afterUpdate(() => {
        if (shouldScroll && messagesEl) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
            shouldScroll = false;
        }
    });

    async function handleSend() {
        const text = input.trim();
        if (!text || $chatLoading) return;
        input = "";
        shouldScroll = true;
        await sendMessage(text);
        shouldScroll = true; // scroll again after reply
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function toggle() {
        chatExpanded.update((v) => !v);
    }

    const starters = [
        "How am I doing this week?",
        "What should I focus on today?",
        "Give me a lighter plan for today",
        "Which subject am I most behind on?",
    ];
</script>

<div
    class="rounded-2xl border border-border-dark overflow-hidden"
    style="background:linear-gradient(135deg,rgba(13,150,139,0.05),rgba(255,255,255,0.02));"
>
    <!-- Header toggle -->
    <button
        type="button"
        class="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
        on:click={toggle}
    >
        <div class="flex items-center gap-3">
            <div
                class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style="background:linear-gradient(135deg,#0d968b,#0a7a70);"
            >
                <span class="material-symbols-outlined text-white text-[18px]"
                    >school</span
                >
            </div>
            <div>
                <p class="text-sm font-bold text-white">Study Tutor</p>
                <p class="text-[11px] text-slate-500">
                    Your AI study coach · Local model
                </p>
            </div>
        </div>

        <div class="flex items-center gap-3">
            {#if $chatLoading}
                <span class="flex gap-1">
                    {#each [0, 1, 2] as i}
                        <span
                            class="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                            style="animation-delay:{i * 0.15}s"
                        ></span>
                    {/each}
                </span>
            {:else if $chatMessages.length > 0}
                <span class="text-[10px] text-slate-500"
                    >{$chatMessages.length} messages</span
                >
            {/if}
            <span
                class="material-symbols-outlined text-slate-500 text-[20px] transition-transform duration-200"
                style="transform:rotate({$chatExpanded ? 180 : 0}deg)"
                >expand_more</span
            >
        </div>
    </button>

    {#if $chatExpanded}
        <!-- Message area -->
        <div
            bind:this={messagesEl}
            class="px-5 overflow-y-auto custom-scrollbar"
            style="max-height:360px;"
        >
            {#if $chatMessages.length === 0}
                <!-- Suggested starters -->
                <div class="py-5">
                    <p
                        class="text-[11px] text-slate-600 uppercase font-bold tracking-widest mb-3"
                    >
                        Try asking
                    </p>
                    <div class="flex flex-wrap gap-2">
                        {#each starters as s}
                            <button
                                type="button"
                                class="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:border-primary/50 hover:text-primary transition-all"
                                on:click={() => {
                                    input = s;
                                }}>{s}</button
                            >
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="py-3 space-y-3">
                    {#each $chatMessages as msg}
                        {#if msg.role === "user"}
                            <div class="flex justify-end">
                                <div
                                    class="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm text-white"
                                    style="background:rgba(13,150,139,0.25);border:1px solid rgba(13,150,139,0.3);"
                                >
                                    {msg.text}
                                </div>
                            </div>
                        {:else}
                            <div class="flex items-start gap-2.5">
                                <div
                                    class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                    style="background:linear-gradient(135deg,#0d968b,#0a7a70);"
                                >
                                    <span
                                        class="material-symbols-outlined text-white text-[14px]"
                                        >auto_awesome</span
                                    >
                                </div>
                                <div class="flex-1">
                                    <div
                                        class="px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm text-slate-300 leading-relaxed"
                                        style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);"
                                    >
                                        {#if msg.text}
                                            {msg.text}
                                        {:else}
                                            <span class="flex gap-1 py-0.5">
                                                {#each [0, 1, 2] as i}
                                                    <span
                                                        class="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                                                        style="animation-delay:{i *
                                                            0.15}s"
                                                    ></span>
                                                {/each}
                                            </span>
                                        {/if}
                                    </div>
                                    {#if msg.planUpdate}
                                        <div
                                            class="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-bold"
                                        >
                                            <span
                                                class="material-symbols-outlined text-[13px]"
                                                >check_circle</span
                                            >
                                            Today's plan updated
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    {/each}
                </div>
            {/if}
        </div>

        <!-- Input row -->
        <div class="px-5 py-4 flex items-center gap-3 border-t border-white/5">
            <input
                type="text"
                bind:value={input}
                on:keydown={handleKeydown}
                placeholder="Ask your tutor anything…"
                class="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
            />
            <button
                type="button"
                on:click={handleSend}
                disabled={$chatLoading || !input.trim()}
                class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-30 hover:scale-105"
                style="background:#0d968b;box-shadow:0 4px 12px rgba(13,150,139,0.3);"
            >
                <span class="material-symbols-outlined text-white text-[18px]"
                    >send</span
                >
            </button>
        </div>
    {/if}
</div>
