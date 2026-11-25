"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Content, Platform, Post } from "@/types";
import { CreatePostModal } from "@/components/calendar/create-post-modal";
import { PostDetailModal } from "@/components/calendar/post-detail-modal";
import {
  getPostCalendarDate,
  getStatusBadgeClasses,
} from "@/components/calendar/calendar-utils";

type CalendarFilter = "all" | "scheduled" | "published" | "other";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [statusFilter, setStatusFilter] = useState<CalendarFilter>("all");

  // Modals
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);

  // Notification banner
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const notify = (type: "success" | "error", message: string) => {
    setBanner({ type, message });
    setTimeout(() => {
      setBanner((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const { data: posts = [], isLoading: loadingPosts } = useQuery<Post[]>({
    queryKey: ["posts"],
    queryFn: async () => {
      const res = await apiClient.get<Post[]>("/posts");
      return res.data;
    },
  });

  const { data: contents = [] } = useQuery<Content[]>({
    queryKey: ["contents"],
    queryFn: async () => {
      const res = await apiClient.get<Content[]>("/contents");
      return res.data;
    },
  });

  const { data: platforms = [] } = useQuery<Platform[]>({
    queryKey: ["platforms"],
    queryFn: async () => {
      const res = await apiClient.get<Platform[]>("/platforms");
      return res.data;
    },
  });

  const contentMap = useMemo(() => new Map(contents.map((c) => [c._id, c])), [contents]);

  const counts = useMemo(() => {
    let scheduled = 0;
    let published = 0;
    let other = 0;
    for (const p of posts) {
      if (p.status === "scheduled") scheduled += 1;
      else if (p.status === "published") published += 1;
      else other += 1;
    }
    return { all: posts.length, scheduled, published, other };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter === "scheduled") return post.status === "scheduled";
      if (statusFilter === "published") return post.status === "published";
      if (statusFilter === "other") {
        return post.status !== "scheduled" && post.status !== "published";
      }
      return true;
    });
  }, [posts, statusFilter]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Array<{ post: Post; date: Date }>>();
    for (const post of filteredPosts) {
      const date = getPostCalendarDate(post);
      if (Number.isNaN(date.getTime())) continue;
      const key = format(date, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push({ post, date });
      map.set(key, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return map;
  }, [filteredPosts]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const selectedDayKey = format(selectedDay, "yyyy-MM-dd");
  const selectedDayPosts = postsByDay.get(selectedDayKey) ?? [];

  const openCreateForDate = (date: Date | null) => {
    setCreateModalDate(date);
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-indigo-400" />
            <span>Content Calendar</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            View posted and scheduled content across dates, or create a new post directly on the calendar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateForDate(selectedDay)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
        >
          <CalendarPlus className="h-4 w-4" />
          <span>Create Post</span>
        </button>
      </div>

      {/* Notification Banner */}
      {banner && (
        <div
          role={banner.type === "error" ? "alert" : "status"}
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition ${
            banner.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Dismiss notification"
            className="text-neutral-400 hover:text-white text-xs px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Pills & Month Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All Posts", count: counts.all, activeClass: "bg-indigo-600 text-white" },
              { id: "scheduled", label: "Scheduled", count: counts.scheduled, activeClass: "bg-sky-600 text-white" },
              { id: "published", label: "Posted", count: counts.published, activeClass: "bg-emerald-600 text-white" },
              { id: "other", label: "Drafts / Failed", count: counts.other, activeClass: "bg-neutral-700 text-white" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                statusFilter === tab.id
                  ? `${tab.activeClass} shadow-sm`
                  : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-800/80">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCurrentMonth(startOfMonth(now));
              setSelectedDay(now);
            }}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-white min-w-[130px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Calendar Grid + Selected Day Agenda */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Month Grid */}
        <div className="xl:col-span-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-900/80">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2.5 px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400"
              >
                {day}
              </div>
            ))}
          </div>

          {loadingPosts ? (
            <div className="h-96 flex items-center justify-center text-xs text-neutral-500 animate-pulse">
              Loading calendar posts...
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayEntries = postsByDay.get(dayKey) ?? [];
                const inCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isSameDay(day, selectedDay);
                const today = isToday(day);
                const visibleEntries = dayEntries.slice(0, 3);
                const overflowCount = dayEntries.length - visibleEntries.length;

                return (
                  <div
                    key={dayKey}
                    onClick={() => setSelectedDay(day)}
                    className={`group min-h-[116px] border-b border-r border-neutral-800/80 p-1.5 flex flex-col gap-1 transition cursor-pointer ${
                      inCurrentMonth ? "bg-neutral-900/30" : "bg-neutral-950/50 text-neutral-600"
                    } ${isSelected ? "ring-1 ring-inset ring-indigo-500/70 bg-indigo-950/20" : "hover:bg-neutral-800/30"}`}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between px-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                        }}
                        aria-label={format(day, "PPPP")}
                        className={`h-6 w-6 rounded-full text-xs font-medium flex items-center justify-center transition ${
                          today
                            ? "bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-600/30"
                            : inCurrentMonth
                            ? "text-neutral-300"
                            : "text-neutral-600"
                        }`}
                      >
                        {format(day, "d")}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                          openCreateForDate(day);
                        }}
                        aria-label={`Create post on ${format(day, "MMM d, yyyy")}`}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 h-6 w-6 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700/70 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Post Chips */}
                    <div className="space-y-1 flex-1 min-w-0">
                      {visibleEntries.map(({ post, date }) => {
                        const linkedContent = contentMap.get(post.content_id);
                        const platformCode = post.targets?.[0]?.platform_code;
                        return (
                          <button
                            key={post._id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDay(day);
                              setActivePost(post);
                            }}
                            className={`w-full text-left px-1.5 py-1 rounded-lg border text-[11px] leading-tight truncate flex items-center gap-1 transition hover:brightness-110 ${getStatusBadgeClasses(
                              post.status
                            )}`}
                          >
                            <span className="font-mono text-[10px] opacity-80 shrink-0">
                              {format(date, "h:mm a")}
                            </span>
                            {platformCode && (
                              <span className="font-bold text-[9px] uppercase opacity-90 shrink-0">
                                {platformCode}
                              </span>
                            )}
                            <span className="truncate font-medium">
                              {linkedContent?.title || "Untitled"}
                            </span>
                          </button>
                        );
                      })}

                      {overflowCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDay(day);
                          }}
                          className="w-full text-left px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
                        >
                          +{overflowCount} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Day Agenda Sidebar */}
        <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-indigo-400">
                {isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE")}
              </p>
              <h2 className="text-base font-bold text-white mt-0.5">
                {format(selectedDay, "MMMM d, yyyy")}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                {selectedDayPosts.length} {selectedDayPosts.length === 1 ? "post" : "posts"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => openCreateForDate(selectedDay)}
              aria-label={`Add post on ${format(selectedDay, "MMM d")}`}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-800 text-[11px] text-neutral-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Posted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Scheduled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Failed
            </span>
          </div>

          {selectedDayPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-center bg-neutral-950/40 space-y-2.5">
              <CalendarDays className="h-7 w-7 text-neutral-600 mx-auto" />
              <p className="text-xs font-medium text-neutral-300">No posts on this date</p>
              <button
                type="button"
                onClick={() => openCreateForDate(selectedDay)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Post</span>
              </button>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {selectedDayPosts.map(({ post, date }) => {
                const linkedContent = contentMap.get(post.content_id);
                return (
                  <li key={post._id}>
                    <button
                      type="button"
                      onClick={() => setActivePost(post)}
                      className="w-full text-left p-3.5 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/60 hover:border-neutral-600 transition space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize border ${getStatusBadgeClasses(
                            post.status
                          )}`}
                        >
                          {post.status}
                        </span>
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {format(date, "h:mm a")}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-white truncate">
                        {linkedContent?.title || `Content ${post.content_id}`}
                      </p>

                      {post.targets?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {post.targets.map((t) => (
                            <span
                              key={t._id}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-sky-400 border border-neutral-700/70"
                            >
                              {t.platform_code}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {/* Create Post Modal */}
      {isCreateOpen && (
        <CreatePostModal
          key={createModalDate ? createModalDate.toISOString() : "new-post"}
          open={isCreateOpen}
          initialDate={createModalDate}
          contents={contents}
          platforms={platforms}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(msg) => notify("success", msg)}
        />
      )}

      {/* Post Detail Modal */}
      {activePost && (
        <PostDetailModal
          key={activePost._id}
          post={activePost}
          content={contentMap.get(activePost.content_id)}
          onClose={() => setActivePost(null)}
          onNotify={notify}
        />
      )}
    </div>
  );
}
