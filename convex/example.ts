import { vWorkflowId, WorkflowManager } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalQuery,
  internalAction,
  mutation,
  internalMutation,
} from "./_generated/server";

export const workflow = new WorkflowManager(components.workflow);

/**
 * Workflow example
 */
export const exampleWorkflow = workflow.define({
  args: { name: v.string() },
  handler: async (step, args): Promise<string> => {
    const queryResult = await step.runQuery(
      internal.example.exampleQuery,
      args
    );

    const actionResult = await step.runAction(internal.example.exampleAction, {
      queryResult,
    });

    return actionResult;
  },
});

export const exampleQuery = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return `the query says... Hi ${args.name}!`;
  },
});

export const exampleAction = internalAction({
  args: { queryResult: v.string() },
  handler: async (ctx, args) => {
    return args.queryResult + " The action says... Hi back!";
  },
});

/**
 * Start Workflow
 */
export const kickoffWorkflow = mutation({
  handler: async (ctx) => {
    const name = "James";
    const workflowId = await workflow.start(
      ctx,
      internal.example.exampleWorkflow,
      { name }
    );
  },
});

/**
 * Start Workflow - onComplete example
 */
export const foo = mutation({
  handler: async (ctx) => {
    const name = "James";
    const workflowId = await workflow.start(
      ctx,
      internal.example.exampleWorkflow,
      { name },
      {
        onComplete: internal.example.handleOnComplete,
        context: name, // can be anything
      }
    );
  },
});

export const handleOnComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(), // used to pass through data from the start site.
  },
  handler: async (ctx, args) => {
    const name = (args.context as { name: string }).name;
    if (args.result.kind === "success") {
      const text = args.result.returnValue;
      console.log(`${name} result: ${text}`);
    } else if (args.result.kind === "failed") {
      console.error("Workflow failed", args.result.error);
    } else if (args.result.kind === "canceled") {
      console.log("Workflow canceled", args.context);
    }
  },
});
