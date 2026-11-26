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
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <span>Content Calendar</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            View posted and scheduled content across dates, or create a new post directly on the calendar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateForDate(selectedDay)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 transition"
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
              ? "bg-success-soft border-success/30 text-success"
              : "bg-danger-soft border-danger/30 text-danger"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Dismiss notification"
            className="text-muted-foreground hover:text-foreground text-xs px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Pills & Month Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All Posts", count: counts.all, activeClass: "bg-primary text-primary-foreground shadow-primary/20" },
              { id: "scheduled", label: "Scheduled", count: counts.scheduled, activeClass: "bg-sky-600 text-white" },
              { id: "published", label: "Posted", count: counts.published, activeClass: "bg-emerald-600 text-white" },
              { id: "other", label: "Drafts / Failed", count: counts.other, activeClass: "bg-purple-600 text-white" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? `${tab.activeClass} shadow-sm font-semibold`
                  : "bg-surface border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  statusFilter === tab.id
                    ? "bg-white/20 text-white"
                    : "bg-surface-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCurrentMonth(startOfMonth(now));
              setSelectedDay(now);
            }}
            className="px-3 py-1.5 rounded-xl bg-surface border border-border hover:bg-surface-muted text-xs font-medium text-foreground transition shrink-0"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl bg-surface border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-foreground min-w-[120px] sm:min-w-[130px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Calendar Grid + Selected Day Agenda */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Month Grid */}
        <div className="xl:col-span-3 rounded-2xl border border-border bg-surface overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-muted">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 sm:py-2.5 px-1 sm:px-2 text-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                <span className="sm:hidden">{day.slice(0, 1)}</span>
                <span className="hidden sm:inline">{day}</span>
              </div>
            ))}
          </div>

          {loadingPosts ? (
            <div className="h-96 flex items-center justify-center text-xs text-muted-foreground animate-pulse">
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
                    className={`group min-h-[64px] sm:min-h-[96px] md:min-h-[116px] border-b border-r border-border p-1 sm:p-1.5 flex flex-col gap-0.5 sm:gap-1 transition cursor-pointer ${
                      inCurrentMonth ? "bg-surface" : "bg-surface-muted/40 text-subtle-foreground"
                    } ${isSelected ? "ring-1 ring-inset ring-primary bg-primary-soft/30" : "hover:bg-surface-muted"}`}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between px-0.5 sm:px-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                        }}
                        aria-label={format(day, "PPPP")}
                        className={`h-5 w-5 sm:h-6 sm:w-6 rounded-full text-[11px] sm:text-xs font-medium flex items-center justify-center transition ${
                          today
                            ? "bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/30"
                            : inCurrentMonth
                            ? "text-foreground"
                            : "text-subtle-foreground"
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
                        className="hidden sm:flex opacity-0 group-hover:opacity-100 focus-visible:opacity-100 h-6 w-6 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Mobile Post Dot Indicators */}
                    <div className="flex md:hidden flex-wrap items-center justify-center gap-1 mt-1 px-0.5">
                      {visibleEntries.map(({ post }) => {
                        let dotColor = "bg-purple-500";
                        if (post.status === "scheduled") dotColor = "bg-sky-500";
                        else if (post.status === "published") dotColor = "bg-emerald-500";
                        else if (post.status === "failed") dotColor = "bg-rose-500";
                        return (
                          <span
                            key={`dot-${post._id}`}
                            className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
                            title={`${post.status} post`}
                          />
                        );
                      })}
                      {overflowCount > 0 && (
                        <span className="text-[9px] text-primary font-bold">+{overflowCount}</span>
                      )}
                    </div>

                    {/* Desktop Post Chips */}
                    <div className="hidden md:block space-y-1 flex-1 min-w-0">
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
                            className={`w-full text-left px-1.5 py-1 rounded-lg border text-[11px] leading-tight truncate flex items-center gap-1 transition hover:brightness-105 ${getStatusBadgeClasses(
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
                          className="w-full text-left px-1.5 py-0.5 text-[10px] font-medium text-primary hover:underline"
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
        <aside className="rounded-2xl border border-border bg-surface p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-primary">
                {isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE")}
              </p>
              <h2 className="text-base font-bold text-foreground mt-0.5">
                {format(selectedDay, "MMMM d, yyyy")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDayPosts.length} {selectedDayPosts.length === 1 ? "post" : "posts"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => openCreateForDate(selectedDay)}
              aria-label={`Add post on ${format(selectedDay, "MMM d")}`}
              className="p-2 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              Posted
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Scheduled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger" />
              Failed
            </span>
          </div>

          {selectedDayPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center bg-surface-muted/30 space-y-2.5">
              <CalendarDays className="h-7 w-7 text-subtle-foreground mx-auto" />
              <p className="text-xs font-medium text-foreground">No posts on this date</p>
              <button
                type="button"
                onClick={() => openCreateForDate(selectedDay)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-medium transition"
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
                      className="w-full text-left p-3.5 rounded-xl bg-surface-muted hover:bg-surface border border-border hover:border-border-strong transition space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize border ${getStatusBadgeClasses(
                            post.status
                          )}`}
                        >
                          {post.status}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {format(date, "h:mm a")}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-foreground truncate">
                        {linkedContent?.title || `Content ${post.content_id}`}
                      </p>

                      {post.targets?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {post.targets.map((t) => (
                            <span
                              key={t._id}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface text-sky-400 border border-border"
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
