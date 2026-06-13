"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";

import {
  createSlackMappingAction,
  deleteSlackMappingAction,
  updateSlackMappingAction,
} from "@/app/(dashboard)/slack/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SlackMappingPageData } from "@/lib/slack/mappings";

type MappingRow = SlackMappingPageData["mappings"][number];

interface SlackMappingManagerProps {
  data: SlackMappingPageData;
  notice?: string | undefined;
  error?: string | undefined;
}

const noticeMessages: Record<string, string> = {
  created: "Mapping created successfully.",
  updated: "Mapping updated successfully.",
  deleted: "Mapping deleted successfully.",
};

function formatDateTime(value: Date | string): string {
  return format(new Date(value), "MMM d, yyyy h:mm a");
}

function getMappingStatus(mapping: MappingRow): {
  label: string;
  variant: "default" | "secondary" | "outline";
} {
  if (mapping.clientId) {
    return { label: "Mapped", variant: "default" };
  }

  return { label: "Needs attribution", variant: "secondary" };
}

function SelectField({
  id,
  name,
  label,
  defaultValue,
  options,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  options: readonly { id: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm" htmlFor={id}>
      <span className="font-medium text-foreground">{label}</span>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <option value="" disabled>
          Select {label.toLowerCase()}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SlackMappingManager({
  data,
  notice,
  error,
}: SlackMappingManagerProps) {
  const [editingMapping, setEditingMapping] = useState<MappingRow | null>(null);

  const clientOptions = useMemo(
    () => data.clients.map((client) => ({ id: client.id, label: client.name })),
    [data.clients],
  );

  const projectOptions = useMemo(
    () =>
      data.projects.map((project) => ({
        id: project.id,
        label: project.name,
      })),
    [data.projects],
  );

  const workflowOptions = useMemo(
    () =>
      data.workflowTypes.map((workflowType) => ({
        id: workflowType.id,
        label: workflowType.name,
      })),
    [data.workflowTypes],
  );

  const formDefaults = editingMapping
    ? {
        slackChannelId: editingMapping.slackChannelId,
        slackChannelName: editingMapping.slackChannelName ?? "",
        clientId: editingMapping.clientId ?? "",
        projectId: editingMapping.projectId ?? "",
        workflowTypeId: editingMapping.defaultWorkflowTypeId ?? "",
      }
    : {
        slackChannelId: "",
        slackChannelName: "",
        clientId: "",
        projectId: "",
        workflowTypeId: "",
      };

  const hasReferenceData =
    data.clients.length > 0 &&
    data.projects.length > 0 &&
    data.workflowTypes.length > 0;

  return (
    <div className="space-y-8">
      {notice && noticeMessages[notice] ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {noticeMessages[notice]}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Connected Slack workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {data.workspaces.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {data.workspaces.map((workspace) => (
                <div key={workspace.id} className="rounded-2xl bg-secondary/70 p-4">
                  <p className="font-medium text-foreground">
                    {workspace.slackTeamName ?? "Slack workspace"}
                  </p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    Team ID: {workspace.slackTeamId}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated {formatDateTime(workspace.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-secondary/70 p-4 text-muted-foreground">
              No Slack workspace connected yet. For local development, seed or
              manually create a SlackWorkspace record.
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            TODO: Add Slack OAuth install flow later.
          </p>
        </CardContent>
      </Card>

      <Card className="surface-panel border-0">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">
            Slack channel mappings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data.workspace ? (
            <p className="text-sm text-muted-foreground">
              Connect a workspace before managing channel mappings.
            </p>
          ) : data.mappings.length === 0 ? (
            <div className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
              No Slack channels mapped yet. Mention Slate in a Slack channel to start
              attribution.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Default Workflow Type</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mappings.map((mapping) => {
                  const status = getMappingStatus(mapping);

                  return (
                    <TableRow key={mapping.id}>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {mapping.slackWorkspace.slackTeamName ?? "Slack workspace"}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {mapping.slackWorkspace.slackTeamId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{mapping.slackChannelName ?? "Unnamed channel"}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {mapping.slackChannelId}
                        </div>
                      </TableCell>
                      <TableCell>{mapping.client?.name ?? "Internal / no client"}</TableCell>
                      <TableCell>{mapping.project?.name ?? "Not set"}</TableCell>
                      <TableCell>
                        {mapping.defaultWorkflowType?.name ?? "Not set"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{formatDateTime(mapping.updatedAt)}</div>
                        <div>Created {formatDateTime(mapping.createdAt)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingMapping(mapping)}
                          >
                            Edit
                          </Button>
                          <form action={deleteSlackMappingAction}>
                            <input
                              type="hidden"
                              name="mappingId"
                              value={mapping.id}
                            />
                            <Button type="submit" variant="destructive" size="sm">
                              Delete
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="surface-panel border-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="font-heading text-2xl">
            {editingMapping ? "Edit mapping manually" : "Add mapping manually"}
          </CardTitle>
          {editingMapping ? (
            <Button type="button" variant="ghost" onClick={() => setEditingMapping(null)}>
              Cancel edit
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {!data.workspace ? (
            <p className="text-sm text-muted-foreground">
              A Slack workspace record is required before creating mappings.
            </p>
          ) : !hasReferenceData ? (
            <p className="text-sm text-muted-foreground">
              Seed clients, projects, and workflow types before creating mappings.
            </p>
          ) : (
            <form
              key={editingMapping?.id ?? "create"}
              action={editingMapping ? updateSlackMappingAction : createSlackMappingAction}
              className="grid gap-4 md:grid-cols-2"
            >
              {editingMapping ? (
                <input type="hidden" name="mappingId" value={editingMapping.id} />
              ) : null}

              <label className="grid gap-2 text-sm" htmlFor="slackChannelId">
                <span className="font-medium text-foreground">Slack channel ID</span>
                <Input
                  id="slackChannelId"
                  name="slackChannelId"
                  defaultValue={formDefaults.slackChannelId}
                  placeholder="C_ACME"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm" htmlFor="slackChannelName">
                <span className="font-medium text-foreground">
                  Slack channel name (optional)
                </span>
                <Input
                  id="slackChannelName"
                  name="slackChannelName"
                  defaultValue={formDefaults.slackChannelName}
                  placeholder="client-acme-seo"
                />
              </label>

              <SelectField
                id="clientId"
                name="clientId"
                label="Client"
                defaultValue={formDefaults.clientId}
                options={clientOptions}
              />

              <SelectField
                id="projectId"
                name="projectId"
                label="Project"
                defaultValue={formDefaults.projectId}
                options={projectOptions}
              />

              <SelectField
                id="workflowTypeId"
                name="workflowTypeId"
                label="Default workflow type"
                defaultValue={formDefaults.workflowTypeId}
                options={workflowOptions}
              />

              <div className="md:col-span-2">
                <Button type="submit">
                  {editingMapping ? "Save mapping" : "Create mapping"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
