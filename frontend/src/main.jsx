import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createTransactionKit } from "@genlayer/transaction-kit";
import { GenLayerTransactionPanel } from "@genlayer/transaction-kit-react";
import { ArrowDown, ArrowUp, BadgeCheck, Box, Check, ChevronRight, Clipboard, Download, ExternalLink, Eye, EyeOff, FileKey2, Gavel, KeyRound, LoaderCircle, Lock, PackageCheck, ScanSearch, Shield, Sparkles, Upload, Users, Wallet, X } from "lucide-react";
import { clean, commitmentPayload, moveRanking, parseRecoveryTicket, phaseCopy, recoveryStorageKey, sha256Hex, short } from "./model.mjs";
import "./styles.css";
import "./font-fallbacks.css";

const ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";
const RPC = import.meta.env.VITE_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const CHAIN_ID = Number(import.meta.env.VITE_GENLAYER_CHAIN_ID || "61997");
const CHAIN = { ...studioDevnet, id: CHAIN_ID, name: "GenLayer Studio Next", rpcUrls: { default: { http: [RPC] } } };
const EXPLORER = "https://explorer-studio-dev.genlayer.com";
const JURORS = ["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333"];
const DEMO = { id: "public-goods-demo", title: "Open systems microgrants", owner: "0x9999999999999999999999999999999999999999", status: "COMMIT", jurors: JURORS, commitments: { [JURORS[0]]: "0".repeat(64) }, reveals: {}, rubric: { host: "example.org", url: "https://example.org/rubric" }, proposals: [{ index: 0, id: "civic-cache", title: "Civic Cache", host: "example.org", url: "https://example.org/civic-cache" }, { index: 1, id: "mesh-notes", title: "Mesh Notes", host: "example.org", url: "https://example.org/mesh-notes" }, { index: 2, id: "public-pulse", title: "Public Pulse", host: "example.org", url: "https://example.org/public-pulse" }], screening: { admitted: ["civic-cache", "mesh-notes", "public-pulse"], screening: [{ index: 0, proposal_id: "civic-cache", state: "ADMIT", rubric_quote: "Every proposal must include a working public prototype", proposal_quote: "A public prototype is available for community testing", explanation: "The mandatory prototype gate has direct evidence." }, { index: 1, proposal_id: "mesh-notes", state: "ADMIT", rubric_quote: "Projects must be open source before final selection", proposal_quote: "The complete source is published under the MIT license", explanation: "The open-source gate has direct evidence." }, { index: 2, proposal_id: "public-pulse", state: "ADMIT", rubric_quote: "Maintenance must cover at least twelve months", proposal_quote: "The maintainers commit to eighteen months of support", explanation: "The maintenance period exceeds the minimum." }] }, result: {} };

function randomSalt() { const bytes = crypto.getRandomValues(new Uint8Array(18)); return [...bytes].map(value => value.toString(16).padStart(2, "0")).join(""); }

function App() {
  const [roundId, setRoundId] = useState("blind-demo-mv2jojwr");
  const [title, setTitle] = useState("Open systems microgrants");
  const [purpose, setPurpose] = useState("Screen public-goods proposals against minimum delivery gates, then rank the admitted batch with sealed juror preferences.");
  const [rubricUrl, setRubricUrl] = useState("https://example.org/rubric");
  const [proposalsText, setProposalsText] = useState(JSON.stringify(DEMO.proposals.map(({ id, title, url }) => ({ id, title, url })), null, 2));
  const [jurorsText, setJurorsText] = useState(JSON.stringify(JURORS, null, 2));
  const [record, setRecord] = useState(DEMO);
  const [ranking, setRanking] = useState(DEMO.screening.admitted);
  const [salt, setSalt] = useState(randomSalt());
  const [sealed, setSealed] = useState("");
  const [importText, setImportText] = useState("");
  const [wallet, setWallet] = useState("");
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const client = useMemo(() => createClient({ chain: CHAIN }), []);
  const kit = useMemo(() => wallet && window.ethereum ? createTransactionKit({ chain: CHAIN, provider: window.ethereum, account: wallet }) : null, [wallet]);

  const load = useCallback(async () => {
    if (!ADDRESS || !roundId.trim()) return;
    setLoading(true);
    try { const next = clean(await client.readContract({ address: ADDRESS, functionName: "get_round", args: [roundId.trim()], jsonSafeReturn: true })); setRecord(next); setRanking(next.screening?.admitted || []); setNotice(""); }
    catch { setNotice("No live round was found. The sample jury room remains visible."); }
    finally { setLoading(false); }
  }, [client, roundId]);
  useEffect(() => { if (ADDRESS) void load(); }, [load]);

  async function connect() {
    if (!window.ethereum) { setNotice("Install a browser wallet to join the jury. Public round evidence stays readable."); return; }
    try { const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }); const chainId = `0x${CHAIN_ID.toString(16)}`; try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] }); } catch (error) { if (error?.code !== 4902) throw error; await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId, chainName: "GenLayer Studio Next", rpcUrls: [RPC], nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 } }] }); } setWallet(accounts[0]); setNotice(""); }
    catch (error) { setNotice(error?.message || "Wallet connection did not complete."); }
  }

  async function prepareCommit() {
    const nextSalt = salt.length >= 16 ? salt : randomSalt();
    setSalt(nextSalt);
    const digest = await sha256Hex(commitmentPayload(roundId.trim(), ranking, nextSalt));
    setSealed(digest); write("commit", digest);
  }
  const tx = useMemo(() => {
    if (!ADDRESS || !action) return null;
    const base = { kind: "write", address: ADDRESS };
    if (action.kind === "create") return { ...base, method: "create_round", args: [roundId.trim(), title.trim(), purpose.trim(), rubricUrl.trim(), proposalsText, jurorsText] };
    if (action.kind === "screen") return { ...base, method: "screen", args: [roundId.trim()] };
    if (action.kind === "commit") return { ...base, method: "commit_ranking", args: [roundId.trim(), action.digest] };
    if (action.kind === "close") return { ...base, method: "close_commits", args: [roundId.trim()] };
    if (action.kind === "reveal") return { ...base, method: "reveal_ranking", args: [roundId.trim(), JSON.stringify(ranking), salt] };
    return { ...base, method: "finalize", args: [roundId.trim()] };
  }, [action, roundId, title, purpose, rubricUrl, proposalsText, jurorsText, ranking, salt]);
  function write(kind, digest = "") { if (!ADDRESS) { setNotice("Deploy the contract and set VITE_CONTRACT_ADDRESS before sending writes."); return; } if (!kit) { setNotice("Connect a Studio Next wallet first."); return; } setAction({ kind, digest }); }
  function done(status) { if (status.phase === "finalized") { setAction(null); if (status.successful) void load(); else setNotice(`Transaction failed: ${status.executionResultName || status.statusName || "contract rejected the input"}.`); } }
  const admitted = record?.screening?.admitted || [];
  const isOwner = wallet && wallet.toLowerCase() === record?.owner;
  const isJuror = wallet && record?.jurors?.includes(wallet.toLowerCase());
  const recovery = JSON.stringify({ round_id: roundId, ranking, salt, commitment: sealed || "create the commitment first" }, null, 2);
  const recoveryKey = wallet && roundId.trim() ? recoveryStorageKey(CHAIN_ID, ADDRESS, roundId.trim(), wallet) : "";

  useEffect(() => {
    if (!recoveryKey || record?.id !== roundId.trim() || admitted.length === 0) return;
    const saved = localStorage.getItem(recoveryKey);
    if (!saved) return;
    try {
      const ticket = parseRecoveryTicket(saved, roundId.trim(), admitted);
      setRanking(ticket.ranking); setSalt(ticket.salt); setSealed(ticket.commitment);
      setNotice("Recovery ticket restored from this browser.");
    } catch { localStorage.removeItem(recoveryKey); }
  }, [recoveryKey, record?.id, roundId, admitted.join(",")]);

  useEffect(() => {
    if (recoveryKey && sealed && record?.id === roundId.trim()) localStorage.setItem(recoveryKey, recovery);
  }, [recoveryKey, recovery, sealed, record?.id, roundId]);

  async function importRecovery() {
    try {
      const ticket = parseRecoveryTicket(importText, roundId.trim(), admitted);
      const digest = await sha256Hex(commitmentPayload(ticket.round_id, ticket.ranking, ticket.salt));
      if (digest !== ticket.commitment) throw new Error("Recovery ticket does not match its commitment.");
      setRanking(ticket.ranking); setSalt(ticket.salt); setSealed(ticket.commitment);
      if (recoveryKey) localStorage.setItem(recoveryKey, JSON.stringify(ticket));
      setImportText(""); setNotice("Recovery ticket imported and verified.");
    } catch (error) { setNotice(error?.message || "Recovery ticket could not be imported."); }
  }

  function downloadRecovery() {
    if (!sealed) return;
    const url = URL.createObjectURL(new Blob([recovery], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `blindbatch-${roundId}-recovery.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="app">
    <header><a href="#top" className="logo"><Box/><b>BLIND<span>BATCH</span></b></a><div className="live"><i/>STUDIO NEXT / {CHAIN_ID}</div><button onClick={connect} className="connect"><Wallet size={15}/>{wallet ? short(wallet) : "ENTER JURY ROOM"}</button></header>
    <main id="top">
      <section className="hero"><div><p><Sparkles size={15}/> FAIR SELECTION, WITHOUT THE SIGNAL LEAK</p><h1>Rank the work.<br/><span>Not the noise.</span></h1></div><div className="hero-stamp"><Shield/><b>RUBRIC<br/>GATED</b><small>SEALED / REVEALED<br/>ON GENLAYER</small></div></section>
      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}><X size={15}/></button></div>}
      <section className="round-bar"><div><small>ROUND LOOKUP</small><input value={roundId} onChange={e => setRoundId(e.target.value)}/><button onClick={() => void load()}>{loading ? <LoaderCircle className="spin"/> : <ScanSearch/>}</button></div><button className="setup-toggle" onClick={() => setShowSetup(value => !value)}>{showSetup ? <EyeOff/> : <Eye/>}{showSetup ? "HIDE SETUP" : "OPEN NEW ROUND"}</button></section>
      {showSetup && <section className="setup"><div><label>ROUND TITLE<input value={title} onChange={e => setTitle(e.target.value)}/></label><label>PURPOSE<textarea rows="3" value={purpose} onChange={e => setPurpose(e.target.value)}/></label><label>PUBLIC RUBRIC URL<input value={rubricUrl} onChange={e => setRubricUrl(e.target.value)}/></label></div><div><label>PROPOSALS / JSON<textarea rows="8" value={proposalsText} onChange={e => setProposalsText(e.target.value)}/></label><label>ODD JURY / JSON<textarea rows="5" value={jurorsText} onChange={e => setJurorsText(e.target.value)}/></label><button onClick={() => write("create")}><PackageCheck/> CREATE ROUND</button></div></section>}

      <section className="room">
        <div className="round-title"><div><small>BATCH / {record?.id}</small><h2>{record?.title}</h2><p>{phaseCopy(record?.status)}</p></div><div className={`phase ${record?.status?.toLowerCase()}`}><span>{record?.status}</span><b>{Object.keys(record?.commitments || {}).length}/{record?.jurors?.length || 0}</b><small>SEALED</small></div></div>
        <div className="process"><div className={record?.status !== "OPEN" ? "done" : "active"}><span>1</span><b>SCREEN</b><small>Evidence gate</small></div><ChevronRight/><div className={record?.status === "COMMIT" ? "active" : ["REVEAL","FINAL"].includes(record?.status) ? "done" : ""}><span>2</span><b>SEAL</b><small>Private ranking</small></div><ChevronRight/><div className={record?.status === "REVEAL" ? "active" : record?.status === "FINAL" ? "done" : ""}><span>3</span><b>REVEAL</b><small>Quorum opens</small></div><ChevronRight/><div className={record?.status === "FINAL" ? "active" : ""}><span>4</span><b>CERTIFY</b><small>Borda result</small></div></div>

        <div className="table-grid">
          <section className="batch"><div className="section-head"><span><PackageCheck/> ADMITTED BATCH</span><a href={record?.rubric?.url} target="_blank">RUBRIC · {record?.rubric?.host} <ExternalLink/></a></div>{record?.proposals?.map(proposal => { const check = record?.screening?.screening?.find(row => row.proposal_id === proposal.id); return <article key={proposal.id} className={check?.state === "ADMIT" ? "admitted" : "held"}><span className="ticket">{String(proposal.index + 1).padStart(2,"0")}</span><div><h3>{proposal.title}</h3><p>{proposal.id}</p></div><b>{check?.state || "UNSCREENED"}</b><a href={proposal.url} target="_blank"><ExternalLink/></a>{check && (check.checks?.length ? check.checks : [check]).map((gate, gateIndex) => <div className="proof" key={`${proposal.id}-${gateIndex}`}><q>{gate.proposal_quote || "No decisive proposal passage"}</q><small>{gate.state ? `${gate.state} · ` : ""}{gate.explanation}</small></div>)}</article>})}<button className="screen" disabled={record?.status !== "OPEN"} onClick={() => write("screen")}><ScanSearch/> RUN VALIDATOR SCREEN</button></section>

          <aside className="jury"><div className="section-head"><span><Users/> JURY RING</span><small>ODD / INDEPENDENT</small></div><div className="jurors">{record?.jurors?.map((juror,index) => <div key={juror} className={record.commitments?.[juror] ? "sealed" : record.reveals?.[juror] ? "revealed" : ""}><span>J{index + 1}</span><code>{short(juror)}</code>{record.reveals?.[juror] ? <Eye/> : record.commitments?.[juror] ? <Lock/> : <EyeOff/>}</div>)}</div><div className="jury-rule"><Gavel/><p>All jurors seal before reveal. A strict majority may certify; missing reveals cannot rewrite submitted ballots.</p></div>{isOwner && record?.status === "COMMIT" && <button onClick={() => write("close")}><KeyRound/> OPEN REVEAL CHAMBER</button>}</aside>
        </div>

        {admitted.length > 0 && <section className="ballot"><div className="ballot-head"><div><small>YOUR ORDER</small><h3>Build the sealed ranking</h3></div><div><EyeOff/><span>Ranking stays hidden until reveal.</span></div></div><ol>{ranking.map((proposalId,index) => { const proposal = record.proposals.find(item => item.id === proposalId); return <li key={proposalId}><span>{index + 1}</span><div><b>{proposal?.title || proposalId}</b><small>{proposalId}</small></div><div><button disabled={index === 0} onClick={() => setRanking(items => moveRanking(items,index,-1))}><ArrowUp/></button><button disabled={index === ranking.length - 1} onClick={() => setRanking(items => moveRanking(items,index,1))}><ArrowDown/></button></div></li>})}</ol><div className="secret"><label>PRIVATE RECOVERY SALT<input value={salt} onChange={e => setSalt(e.target.value)}/></label><button className="seal-button" disabled={!isJuror || record.status !== "COMMIT"} onClick={() => void prepareCommit()}><Lock/> SEAL MY RANKING</button><button disabled={!isJuror || record.status !== "REVEAL"} onClick={() => write("reveal")}><Eye/> REVEAL MY RANKING</button></div><div className="recovery"><FileKey2/><div><b>RECOVERY TICKET</b><p>Saved automatically in this browser after sealing. Copy or download it for portable recovery.</p></div><textarea readOnly value={recovery}/><div className="recovery-actions"><button disabled={!sealed} onClick={() => navigator.clipboard?.writeText(recovery)}><Clipboard/> COPY</button><button disabled={!sealed} onClick={downloadRecovery}><Download/> DOWNLOAD</button></div><div className="recovery-import"><textarea placeholder="Paste a recovery ticket to restore ranking, salt, and commitment" value={importText} onChange={event => setImportText(event.target.value)}/><button disabled={!importText.trim()} onClick={() => void importRecovery()}><Upload/> IMPORT</button></div></div></section>}

        {record?.status === "REVEAL" && <button className="certify" onClick={() => write("finalize")}><BadgeCheck/> CERTIFY WHEN QUORUM IS READY</button>}
        {record?.status === "FINAL" && <section className="winner"><div><BadgeCheck/><span>CERTIFIED WINNER</span></div><h2>{record.result?.winner}</h2><p>{record.result?.reveals_counted} revealed ballots counted · quorum {record.result?.quorum}</p></section>}
      </section>
      <section className="boundary"><Lock/><p><b>What BlindBatch guarantees:</b> frozen public evidence, quote-bound rubric screening, sealed jury preferences, deterministic tallying, and an auditable reveal quorum. It does not prove juror independence off-chain or guarantee funding impact.</p></section>
    </main>
    <footer><span>BLINDBATCH / EVIDENCE GATE → SEALED CHOICE</span>{ADDRESS ? <a href={`${EXPLORER}/address/${ADDRESS}`} target="_blank">CONTRACT {short(ADDRESS)} <ExternalLink/></a> : <b>CONTRACT NOT DEPLOYED</b>}</footer>
    {action && kit && tx && <div className="tx-cover"><div className="tx-box"><div><span>GENLAYER TRANSACTION</span><button onClick={() => setAction(null)}><X/></button></div><GenLayerTransactionPanel kit={kit} tx={tx} network="GenLayer Studio Next" theme="dark" trackUntil="finalized" onDone={done}/></div></div>}
  </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
