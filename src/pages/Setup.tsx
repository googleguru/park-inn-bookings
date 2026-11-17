import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, Copy, ExternalLink, Loader2, XCircle } from "lucide-react";
import backendCode from "../../google-apps-script/Code.gs?raw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_URL, callApi, isApiConfigured, type SystemStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

const REPO_VARIABLES_URL = "https://github.com/googleguru/park-inn-bookings/settings/variables/actions";
const DEPLOY_WORKFLOW_URL = "https://github.com/googleguru/park-inn-bookings/actions/workflows/deploy.yml";
const WEB_APP_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="relative rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
      <div className="flex gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-serif text-lg text-gold">
          {n}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
        </div>
      </div>
    </li>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-medium text-foreground">{children}</span>
);

export default function Setup() {
  const [url, setUrl] = useState(API_URL);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const test = async () => {
    const clean = url.trim();
    setResult(null);
    if (!WEB_APP_URL.test(clean)) {
      setResult({ ok: false, message: "That doesn't look like a web app URL. It should start with https://script.google.com/macros/s/ and end with /exec." });
      return;
    }
    setTesting(true);
    try {
      const status = await callApi<SystemStatus>(clean, "status");
      setResult(status.configured
        ? { ok: true, message: `Connected to ${status.venueName}. Online booking is ${status.bookingEnabled ? "on" : "off"}.` }
        : { ok: false, message: "The script is reachable but setup hasn't run yet. Go back to step 3 and run setup." });
    } catch (err) {
      setResult({ ok: false, message: `Could not connect: ${(err as Error).message} Check that "Who has access" is set to Anyone.` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back
        </Link>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">One-time setup · about 10 minutes · free</p>
        <h1 className="mt-2 text-4xl font-semibold md:text-5xl">
          Connect your <span className="italic text-primary">Google account</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Your bookings, customers, income and expenses will be kept in a Google Sheet in your own Google account, and
          confirmed bookings will appear in your Google Calendar. Nothing to pay and no technical accounts to create.
        </p>
        {isApiConfigured && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={15} /> This website is already connected. Use these steps only to set up again.
          </p>
        )}

        <ol className="mt-10 space-y-5">
          <Step n={1} title="Create a Google Sheet">
            <p>Sign in to the Gmail account that should own the bookings (the venue's account), then create a new, empty sheet.</p>
            <Button asChild className="gap-2">
              <a href="https://sheets.new" target="_blank" rel="noreferrer">Create Google Sheet <ExternalLink size={14} /></a>
            </Button>
            <p>Give it a name such as <b>Park Inn Bookings</b>.</p>
          </Step>

          <Step n={2} title="Add the booking script">
            <p>In the sheet, open <Kbd>Extensions</Kbd> → <Kbd>Apps Script</Kbd>. Delete the few lines already there, then paste the script:</p>
            <CopyButton text={backendCode} label="Copy the script" />
            <p>Click the <Kbd>💾 Save</Kbd> icon.</p>
          </Step>

          <Step n={3} title="Run setup once">
            <p>
              In the toolbar, pick <Kbd>setup</Kbd> from the function list and press <Kbd>▶ Run</Kbd>. Google will ask for
              permission because the script works with your Sheet, Calendar and Gmail:
            </p>
            <p>
              <Kbd>Review permissions</Kbd> → choose your account → <Kbd>Advanced</Kbd> → <Kbd>Go to … (unsafe)</Kbd> → <Kbd>Allow</Kbd>.
              It says "unsafe" only because you wrote the script yourself instead of Google reviewing it.
            </p>
            <p>When the log says <b>Execution completed</b>, your sheet has new tabs and a <b>Park Inn Bookings</b> calendar exists.</p>
          </Step>

          <Step n={4} title="Publish it as a web app">
            <p>
              Click <Kbd>Deploy</Kbd> → <Kbd>New deployment</Kbd> → the ⚙ icon → <Kbd>Web app</Kbd>. Set
              <b> Execute as: Me</b> and <b>Who has access: Anyone</b>, then <Kbd>Deploy</Kbd>.
            </p>
            <p>Copy the <b>Web app URL</b> (it ends with <code>/exec</code>) and paste it here:</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/…/exec"
                className="h-11 font-mono text-xs"
                aria-label="Web app URL"
              />
              <Button onClick={test} disabled={testing || !url.trim()} className="h-11 gap-2">
                {testing && <Loader2 className="h-4 w-4 animate-spin" />} Test connection
              </Button>
            </div>
            {result && (
              <p role="status" className={cn(
                "flex items-start gap-2 rounded-xl p-3 text-sm",
                result.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-destructive/10 text-destructive",
              )}>
                {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
                {result.message}
              </p>
            )}
          </Step>

          <Step n={5} title="Switch the website on">
            <p>
              Send the web app URL to whoever manages this website, or do it yourself in GitHub: open{" "}
              <a className="text-primary underline" href={REPO_VARIABLES_URL} target="_blank" rel="noreferrer">repository variables</a>, add a
              variable named <Kbd>BOOKING_API_URL</Kbd> with the URL as its value, then{" "}
              <a className="text-primary underline" href={DEPLOY_WORKFLOW_URL} target="_blank" rel="noreferrer">run the deploy</a>.
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text="BOOKING_API_URL" label="Copy variable name" />
              {result?.ok && <CopyButton text={url.trim()} label="Copy web app URL" />}
            </div>
            <p>
              A few minutes later booking opens on the website. Sign in at <Link to="/admin" className="text-primary underline">/admin</Link> with
              the same Gmail address; you'll get a 6-digit code by email.
            </p>
          </Step>
        </ol>

        <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">When the script is updated later</p>
          <p className="mt-1">
            Paste the new script over the old one, save, then <Kbd>Deploy</Kbd> → <Kbd>Manage deployments</Kbd> → ✏️ →
            Version: <b>New version</b> → <Kbd>Deploy</Kbd>. The URL stays the same, so the website needs no change.
          </p>
        </div>
      </div>
    </div>
  );
}
