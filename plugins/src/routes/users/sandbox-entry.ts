// import { definePlugin } from "emdash";

// export default definePlugin({
//   routes: {
//     // ── /me ──────────────────────────────────────────────
//     "me":                    { public: false, handler: getMe               },
//     "me/profile/update":     { public: false, input: UpdateProfileSchema,
//                                handler: updateMyProfile                    },
//     "me/follow":             { public: false, input: FollowSchema,
//                                handler: followUser                         },
//     "me/unfollow":           { public: false, input: FollowSchema,
//                                handler: unfollowUser                       },
//     "me/block":              { public: false, input: FollowSchema,
//                                handler: blockUser                          },
//     "me/unblock":            { public: false, input: FollowSchema,
//                                handler: unblockUser                        },
//     "me/friend-requests":    { public: false, handler: listFriendRequests  },
//     "me/friend-requests/sent":   { public: false,
//                                    handler: listSentFriendRequests         },
//     "me/friend-requests/send":   { public: false,
//                                    input: SendFriendRequestSchema,
//                                    handler: sendFriendRequest              },
//     "me/friend-requests/respond":{ public: false,
//                                    input: RespondFriendRequestSchema,
//                                    handler: respondFriendRequest           },
//     "me/friend-requests/cancel": { public: false,
//                                    input: RespondFriendRequestSchema,
//                                    handler: cancelFriendRequest            },

//     // ── /:username equivalent ─────────────────────────────
//     "profile":               { public: true, input: GetProfileSchema,
//                                handler: getPublicProfile                   },
//     "profile/followers":     { public: true, input: GetProfileSchema,
//                                handler: getFollowers                       },
//     "profile/following":     { public: true, input: GetProfileSchema,
//                                handler: getFollowing                       },

//     // ── Admin ─────────────────────────────────────────────
//     "admin/users":           { public: false, handler: adminListUsers      },

//     admin: {
//       handler: async (ctx: PluginContext) => {
//         const interaction = await ctx.request.json();
//         if (interaction.type === "page_load") {
//           return {
//             blocks: [
//               { type: "header", text: "Users" },
//               { type: "section", text: "Manage Mindplex users, follows, and friend requests." },
//             ],
//           };
//         }
//         return { blocks: [] };
//       },
//     },
//   }
// });