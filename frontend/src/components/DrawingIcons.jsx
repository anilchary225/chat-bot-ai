import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useInView } from "framer-motion";
import * as Lucide from "lucide-react";

const SVG_NS = "http://www.w3.org/2000/svg";
const GEOMETRY = "path, rect, circle, ellipse, line, polyline, polygon";

function drawIcon(svg) {
  const shapes = [...svg.querySelectorAll(GEOMETRY)].flatMap((node) => {
    const length = node.getTotalLength?.() ?? 0;
    return length ? [{ node, length }] : [];
  });
  if (!shapes.length) return;

  const pointLayer = document.createElementNS(SVG_NS, "g");
  pointLayer.setAttribute("pointer-events", "none");
  pointLayer.setAttribute("aria-hidden", "true");
  svg.append(pointLayer);

  const totalLength = shapes.reduce((total, shape) => total + shape.length, 0);
  let delay = 0;
  const animations = shapes.flatMap(({ node, length }) => {
    const duration = Math.max(65, 680 * length / totalLength);
    const timing = { duration, delay, fill: "both" };
    delay += duration;

    const point = node.cloneNode(false);
    point.removeAttribute("id");
    point.style.fill = "none";
    point.style.strokeWidth = `${parseFloat(getComputedStyle(node).strokeWidth) + 1.4}px`;
    point.style.strokeLinecap = "round";
    pointLayer.append(point);

    return [
      node.animate([
        { strokeDasharray: `${length}px ${length + 1}px`, strokeDashoffset: `${length}px`, opacity: 0 },
        { strokeDasharray: `${length}px ${length + 1}px`, strokeDashoffset: `${length * 0.99}px`, opacity: 1, offset: 0.01 },
        { strokeDasharray: `${length}px ${length + 1}px`, strokeDashoffset: "0px", opacity: 1 },
      ], timing),
      point.animate([
        { strokeDasharray: `0.01px ${length + 1}px`, strokeDashoffset: "0px", opacity: 0 },
        { opacity: 1, offset: 0.04 },
        { opacity: 1, offset: 0.9 },
        { strokeDasharray: `0.01px ${length + 1}px`, strokeDashoffset: `${-length}px`, opacity: 0 },
      ], timing),
    ];
  });

  const cleanup = () => {
    animations.forEach((animation) => animation.cancel());
    pointLayer.remove();
  };
  void Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanup);
  return cleanup;
}

function withDrawing(Icon) {
  return forwardRef(function DrawingIcon(props, forwardedRef) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    useImperativeHandle(forwardedRef, () => ref.current, []);

    useEffect(() => {
      const svg = ref.current;
      if (!inView || !svg?.animate) return;
      const hoverTarget = svg.closest("a, button, [role='button']") ?? svg;
      let stop;
      function play() {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        stop?.();
        stop = drawIcon(svg);
      }
      play();
      hoverTarget.addEventListener("pointerenter", play);
      return () => {
        stop?.();
        hoverTarget.removeEventListener("pointerenter", play);
      };
    }, [inView]);

    return <Icon ref={ref} {...props} />;
  });
}

export const AlertCircle = withDrawing(Lucide.AlertCircle);
export const AlertTriangle = withDrawing(Lucide.AlertTriangle);
export const ArrowDown = withDrawing(Lucide.ArrowDown);
export const ArrowLeft = withDrawing(Lucide.ArrowLeft);
export const ArrowRight = withDrawing(Lucide.ArrowRight);
export const ArrowUp = withDrawing(Lucide.ArrowUp);
export const Ban = withDrawing(Lucide.Ban);
export const BarChart3 = withDrawing(Lucide.BarChart3);
export const BatteryFull = withDrawing(Lucide.BatteryFull);
export const Bot = withDrawing(Lucide.Bot);
export const Briefcase = withDrawing(Lucide.Briefcase);
export const Check = withDrawing(Lucide.Check);
export const CheckCircle2 = withDrawing(Lucide.CheckCircle2);
export const ChevronLeft = withDrawing(Lucide.ChevronLeft);
export const ClipboardPaste = withDrawing(Lucide.ClipboardPaste);
export const Clock = withDrawing(Lucide.Clock);
export const Code2 = withDrawing(Lucide.Code2);
export const Copy = withDrawing(Lucide.Copy);
export const Download = withDrawing(Lucide.Download);
export const ExternalLink = withDrawing(Lucide.ExternalLink);
export const FileCode2 = withDrawing(Lucide.FileCode2);
export const FileSpreadsheet = withDrawing(Lucide.FileSpreadsheet);
export const FileText = withDrawing(Lucide.FileText);
export const Globe = withDrawing(Lucide.Globe);
export const Heart = withDrawing(Lucide.Heart);
export const HelpCircle = withDrawing(Lucide.HelpCircle);
export const Image = withDrawing(Lucide.Image);
export const ImagePlus = withDrawing(Lucide.ImagePlus);
export const Inbox = withDrawing(Lucide.Inbox);
export const Info = withDrawing(Lucide.Info);
export const Instagram = withDrawing(Lucide.Instagram);
export const KeyRound = withDrawing(Lucide.KeyRound);
export const LayoutDashboard = withDrawing(Lucide.LayoutDashboard);
export const Lightbulb = withDrawing(Lucide.Lightbulb);
export const LoaderCircle = Lucide.LoaderCircle;
export const LogOut = withDrawing(Lucide.LogOut);
export const Mail = withDrawing(Lucide.Mail);
export const MailWarning = withDrawing(Lucide.MailWarning);
export const Menu = withDrawing(Lucide.Menu);
export const MessageCircle = withDrawing(Lucide.MessageCircle);
export const MessageSquare = withDrawing(Lucide.MessageSquare);
export const MessageSquareText = withDrawing(Lucide.MessageSquareText);
export const Mic = withDrawing(Lucide.Mic);
export const Moon = withDrawing(Lucide.Moon);
export const MoreHorizontal = withDrawing(Lucide.MoreHorizontal);
export const Palette = withDrawing(Lucide.Palette);
export const PanelLeftClose = withDrawing(Lucide.PanelLeftClose);
export const PanelLeftOpen = withDrawing(Lucide.PanelLeftOpen);
export const Paperclip = withDrawing(Lucide.Paperclip);
export const PenLine = withDrawing(Lucide.PenLine);
export const Phone = withDrawing(Lucide.Phone);
export const Play = withDrawing(Lucide.Play);
export const Plus = withDrawing(Lucide.Plus);
export const RefreshCw = withDrawing(Lucide.RefreshCw);
export const Rocket = withDrawing(Lucide.Rocket);
export const RotateCcw = withDrawing(Lucide.RotateCcw);
export const Search = withDrawing(Lucide.Search);
export const SearchCheck = withDrawing(Lucide.SearchCheck);
export const Send = withDrawing(Lucide.Send);
export const Server = withDrawing(Lucide.Server);
export const ShieldCheck = withDrawing(Lucide.ShieldCheck);
export const Signal = withDrawing(Lucide.Signal);
export const Smartphone = withDrawing(Lucide.Smartphone);
export const Sparkles = withDrawing(Lucide.Sparkles);
export const StickyNote = withDrawing(Lucide.StickyNote);
export const Sun = withDrawing(Lucide.Sun);
export const Target = withDrawing(Lucide.Target);
export const Trash2 = withDrawing(Lucide.Trash2);
export const TrendingUp = withDrawing(Lucide.TrendingUp);
export const Upload = withDrawing(Lucide.Upload);
export const User = withDrawing(Lucide.User);
export const UserCheck = withDrawing(Lucide.UserCheck);
export const Users = withDrawing(Lucide.Users);
export const Video = withDrawing(Lucide.Video);
export const Wand2 = withDrawing(Lucide.Wand2);
export const Wifi = withDrawing(Lucide.Wifi);
export const X = withDrawing(Lucide.X);
export const XCircle = withDrawing(Lucide.XCircle);
export const Zap = withDrawing(Lucide.Zap);
