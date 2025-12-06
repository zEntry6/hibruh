const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');
const { shapeConversation } = require('./conversationController');
const crypto = require('crypto');

const generateInviteCode = () => crypto.randomBytes(8).toString('hex');

const createGroupSystemMessage = async (conversation, actorId, systemType, meta = {}) => {
  try {
    if (!conversation || !actorId) return;

    const actor = await User.findById(actorId).lean();
    const actorName = actor?.displayName || actor?.username || 'Someone';

    let text = '';

    switch (systemType) {
      case 'group_created':
        text = `${actorName} created the group`;
        break;
      case 'group_renamed': {
        const newName = meta.newName || conversation.name;
        text = `${actorName} changed the group name to "${newName}"`;
        break;
      }
      case 'group_member_added': {
        const addedNames =
          meta.addedUsers?.map((u) => u.displayName || u.username) || [];
        text =
          addedNames.length > 0
            ? `${actorName} added ${addedNames.join(', ')}`
            : `${actorName} updated the group members`;
        break;
      }
      case 'group_member_removed': {
        const removedNames =
          meta.removedUsers?.map((u) => u.displayName || u.username) || [];
        text =
          removedNames.length > 0
            ? `${actorName} removed ${removedNames.join(', ')}`
            : `${actorName} updated the group members`;
        break;
      }
      case 'group_member_left': {
        const leaverName =
          meta.leaver?.displayName ||
          meta.leaver?.username ||
          actorName;
        text = `${leaverName} left the group`;
        break;
      }
      case 'group_avatar_changed':
        text = `${actorName} changed the group photo`;
        break;
      default:
        return;
            case 'group_admin_promoted': {
        const promotedNames =
          meta.promotedUsers?.map((u) => u.displayName || u.username) || [];
        if (promotedNames.length === 0) return;
        text = `${actorName} made ${promotedNames.join(', ')} admin${
          promotedNames.length > 1 ? 's' : ''
        }`;
        break;
      }
      case 'group_admin_demoted': {
        const demotedNames =
          meta.demotedUsers?.map((u) => u.displayName || u.username) || [];
        if (demotedNames.length === 0) return;
        text = `${actorName} removed admin rights from ${demotedNames.join(
          ', '
        )}`;
        break;
      }
    }

    await Message.create({
      conversationId: conversation._id,
      senderId: actor?._id || actorId,
      text,
      type: 'system',
      systemType,
      systemMeta: meta,
      status: 'sent'
    });
  } catch (err) {
    console.error('createGroupSystemMessage error', err);
  }
};

// POST /api/groups
// Body: { name, memberIds: [userId1, userId2, ...], avatarUrl? }
exports.createGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, memberIds, avatarUrl } = req.body;

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    if (!Array.isArray(memberIds) || memberIds.length < 2) {
      return res
        .status(400)
        .json({ message: 'Select at least 2 other members for a group' });
    }

    const uniqueMemberIds = [
      ...new Set(memberIds.map((id) => id.toString()))
    ].filter((id) => id !== userId.toString());

    if (uniqueMemberIds.length < 2) {
      return res
        .status(400)
        .json({ message: 'Select at least 2 other members for a group' });
    }

    const users = await User.find({ _id: { $in: uniqueMemberIds } }).select(
      '_id'
    );
    if (users.length !== uniqueMemberIds.length) {
      return res.status(400).json({ message: 'Some members are invalid' });
    }

    const participants = [userId, ...uniqueMemberIds];

    let group = await Conversation.create({
      isGroup: true,
      name: trimmedName,
      avatarUrl: avatarUrl || '',
      participants,
      createdBy: userId,
      admins: [userId],
      lastMessage: null,
      readBy: [
        {
          user: userId,
          lastReadAt: new Date()
        }
      ]
    });

     // system message: group created
    await createGroupSystemMessage(group, userId, 'group_created', {});

    group = await group.populate(
      'participants',
      'username displayName avatarUrl lastSeen'
    );

    const base = typeof group.toObject === 'function' ? group.toObject() : group;
    const shaped = shapeConversation(base, userId, 0);

    return res.status(201).json(shaped);
  } catch (err) {
    console.error('createGroup error', err);
    return res.status(500).json({ message: 'Failed to create group' });
  }
};

// PATCH /api/groups/:id
// Body: { name?, avatarUrl? }  (admin / creator only)
exports.updateGroupDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, avatarUrl } = req.body;

    let group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.admins
      .map((a) => a.toString())
      .includes(userId.toString());
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can edit group' });
    }

    const oldName = group.name;
    const oldAvatar = group.avatarUrl;

    let nameChanged = false;
    let avatarChanged = false;

    if (typeof name === 'string' && name.trim()) {
      const newName = name.trim();
      if (newName !== group.name) {
        group.name = newName;
        if (newName !== oldName) {
          nameChanged = true;
        }
      }
    }
    if (typeof avatarUrl === 'string') {
      const newAvatar = avatarUrl.trim();
      if (newAvatar !== group.avatarUrl) {
        group.avatarUrl = newAvatar;
        if (newAvatar !== oldAvatar) {
          avatarChanged = true;
        }
      }
    }

    await group.save();

    if (nameChanged) {
      await createGroupSystemMessage(group, userId, 'group_renamed', {
        oldName,
        newName: group.name
      });
    }

    if (avatarChanged) {
      await createGroupSystemMessage(
        group,
        userId,
        'group_avatar_changed',
        {
          oldAvatar,
          newAvatar: group.avatarUrl
        }
      );
    }

    group = await group.populate(
      'participants',
      'username displayName avatarUrl lastSeen'
    );

    const shaped = shapeConversation(group.toObject(), userId, 0);
    return res.json(shaped);
  } catch (err) {
    console.error('updateGroupDetails error', err);
    return res.status(500).json({ message: 'Failed to update group' });
  }
};

// PATCH /api/groups/:id/members
// Body: { addMemberIds?: [], removeMemberIds?: [] }  (admin only)
exports.modifyGroupMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { addMemberIds = [], removeMemberIds = [] } = req.body;

    let group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.admins
      .map((a) => a.toString())
      .includes(userId.toString());
    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can edit members' });
    }

    const creatorId = group.createdBy?.toString();

        // untuk system message
    let addedUserIds = [];
    let removedUserIds = [];

    const participantsSet = new Set(
      group.participants.map((p) => p.toString())
    );

    // ADD
    if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
      const uniqueAdds = [
        ...new Set(addMemberIds.map((id) => id.toString()))
      ].filter((id) => !participantsSet.has(id));

      if (uniqueAdds.length > 0) {
        const users = await User.find({ _id: { $in: uniqueAdds } }).select(
          '_id'
        );
        const validIds = users.map((u) => u._id.toString());
        validIds.forEach((id) => participantsSet.add(id));

        addedUserIds = validIds;
      }
    }

    // REMOVE
    if (Array.isArray(removeMemberIds) && removeMemberIds.length > 0) {
      const uniqueRemoves = [
        ...new Set(removeMemberIds.map((id) => id.toString()))
      ];

      
      if (uniqueRemoves.length > 0) {
        removedUserIds = uniqueRemoves;
      }

      uniqueRemoves.forEach((id) => {
        // creator tidak boleh dikeluarkan lewat endpoint ini
        if (creatorId && id === creatorId) return;
        participantsSet.delete(id);
      });

      // pastikan admins juga dikurangi
      const newAdmins = group.admins.filter((a) =>
        participantsSet.has(a.toString())
      );
      group.admins = newAdmins;
    }

    // creator harus tetap participant
    if (creatorId) {
      participantsSet.add(creatorId);
    }

    group.participants = Array.from(participantsSet);

    await group.save();

        // system message: member ditambah
    if (addedUserIds.length > 0) {
      const addedUsers = await User.find({ _id: { $in: addedUserIds } })
        .select('username displayName')
        .lean();

      if (addedUsers.length > 0) {
        await createGroupSystemMessage(group, userId, 'group_member_added', {
          addedUsers
        });
      }
    }

    // system message: member dikurangi
    if (removedUserIds.length > 0) {
      const removedUsers = await User.find({ _id: { $in: removedUserIds } })
        .select('username displayName')
        .lean();

      if (removedUsers.length > 0) {
        await createGroupSystemMessage(
          group,
          userId,
          'group_member_removed',
          { removedUsers }
        );
      }
    }

    group = await group.populate(
      'participants',
      'username displayName avatarUrl lastSeen'
    );

    const shaped = shapeConversation(group.toObject(), userId, 0);
    return res.json(shaped);
  } catch (err) {
    console.error('modifyGroupMembers error', err);
    return res.status(500).json({ message: 'Failed to update members' });
  }
};

// PATCH /api/groups/:id/admins
// Body: { addAdminIds?: [], removeAdminIds?: [] }  (admin only)
exports.updateGroupAdmins = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { addAdminIds = [], removeAdminIds = [] } = req.body;

    let group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.admins
      .map((a) => a.toString())
      .includes(userId.toString());
    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: 'Only admins can edit admin roles' });
    }

    const creatorId = group.createdBy?.toString();
    const participantIds = group.participants.map((p) => p.toString());
    const participantSet = new Set(participantIds);
    const adminSet = new Set(group.admins.map((a) => a.toString()));

    let promotedUserIds = [];
    let demotedUserIds = [];

    // ADD ADMIN
    if (Array.isArray(addAdminIds) && addAdminIds.length > 0) {
      const uniqueAdds = [
        ...new Set(addAdminIds.map((val) => val.toString()))
      ];

      uniqueAdds.forEach((targetId) => {
        if (!participantSet.has(targetId)) return;
        if (!adminSet.has(targetId)) {
          adminSet.add(targetId);
          promotedUserIds.push(targetId);
        }
      });
    }

    // REMOVE ADMIN (creator tidak boleh di-demote)
    if (Array.isArray(removeAdminIds) && removeAdminIds.length > 0) {
      const uniqueRemoves = [
        ...new Set(removeAdminIds.map((val) => val.toString()))
      ];

      uniqueRemoves.forEach((targetId) => {
        if (creatorId && targetId === creatorId) return;
        if (adminSet.has(targetId)) {
          adminSet.delete(targetId);
          demotedUserIds.push(targetId);
        }
      });
    }

    group.admins = Array.from(adminSet);
    await group.save();

    // system message: admin promoted
    if (promotedUserIds.length > 0) {
      const promotedUsers = await User.find({ _id: { $in: promotedUserIds } })
        .select('username displayName')
        .lean();

      if (promotedUsers.length > 0) {
        await createGroupSystemMessage(group, userId, 'group_admin_promoted', {
          promotedUsers
        });
      }
    }

    // system message: admin demoted
    if (demotedUserIds.length > 0) {
      const demotedUsers = await User.find({ _id: { $in: demotedUserIds } })
        .select('username displayName')
        .lean();

      if (demotedUsers.length > 0) {
        await createGroupSystemMessage(group, userId, 'group_admin_demoted', {
          demotedUsers
        });
      }
    }

    group = await group.populate(
      'participants',
      'username displayName avatarUrl lastSeen'
    );

    const shaped = shapeConversation(group.toObject(), userId, 0);
    return res.json(shaped);
  } catch (err) {
    console.error('updateGroupAdmins error', err);
    return res.status(500).json({ message: 'Failed to update admins' });
  }
};

// POST /api/groups/:id/invite
// generate / reset invite code (admin only)
exports.generateGroupInvite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    let group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isAdmin = group.admins
      .map((a) => a.toString())
      .includes(userId.toString());
    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: 'Only admins can generate invite links' });
    }

    const newCode = generateInviteCode();
    group.inviteCode = newCode;
    group.inviteCodeCreatedAt = new Date();

    await group.save();

    group = await group.populate(
      'participants',
      'username displayName avatarUrl lastSeen'
    );

    const shaped = shapeConversation(group.toObject(), userId, 0);
    return res.json(shaped);
  } catch (err) {
    console.error('generateGroupInvite error', err);
    return res.status(500).json({ message: 'Failed to generate invite link' });
  }
};

// POST /api/groups/join-by-code
exports.joinGroupByCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ message: 'Invite code is required' });
    }

    const trimmed = code.trim();

    let group = await Conversation.findOne({
      isGroup: true,
      inviteCode: trimmed
    });

    if (!group) {
      return res
        .status(404)
        .json({ message: 'Group not found for this code' });
    }

    const userIdStr = userId.toString();
    const participantIds = group.participants.map((p) => p.toString());

    let justJoined = false;
    if (!participantIds.includes(userIdStr)) {
      group.participants.push(userId);
      justJoined = true;
    }

    // update readBy untuk user ini
    if (!Array.isArray(group.readBy)) {
      group.readBy = [];
    }
    const existingEntry = group.readBy.find(
      (rb) => String(rb.user) === userIdStr
    );
    const now = new Date();
    if (existingEntry) {
      existingEntry.lastReadAt = now;
    } else {
      group.readBy.push({ user: userId, lastReadAt: now });
    }

    await group.save();

    if (justJoined) {
      const joinedUser = await User.findById(userId)
        .select('username displayName')
        .lean();

      if (joinedUser) {
        await createGroupSystemMessage(group, userId, 'group_member_added', {
          addedUsers: [joinedUser]
        });
      }
    }

    group = await group.populate(
      'participants',
      'username displayName avatarUrl lastSeen'
    );

    const shaped = shapeConversation(group.toObject(), userId, 0);
    return res.json(shaped);
  } catch (err) {
    console.error('joinGroupByCode error', err);
    return res.status(500).json({ message: 'Failed to join group' });
  }
};

// POST /api/groups/:id/leave
// non-creator boleh leave; creator harus delete group
exports.leaveGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const creatorId = group.createdBy?.toString();
    if (creatorId && creatorId === userId.toString()) {
      return res.status(400).json({
        message: 'Creators must delete the group instead of leaving it'
      });
    }

    const participants = group.participants.map((p) => p.toString());
    if (!participants.includes(userId.toString())) {
      return res.status(400).json({ message: 'You are not in this group' });
    }

    group.participants = group.participants.filter(
      (p) => p.toString() !== userId.toString()
    );
    group.admins = group.admins.filter(
      (a) => a.toString() !== userId.toString()
    );
    group.readBy = group.readBy.filter(
      (r) => r.user.toString() !== userId.toString()
    );

    await group.save();

       // system message: user ini keluar dari group
    await createGroupSystemMessage(group, userId, 'group_member_left', {});
    
    return res.status(204).send();
  } catch (err) {
    console.error('leaveGroup error', err);
    return res.status(500).json({ message: 'Failed to leave group' });
  }
};

// DELETE /api/groups/:id
// hanya creator
exports.deleteGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const group = await Conversation.findById(id);
    if (!group || !group.isGroup) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const creatorId = group.createdBy?.toString();
    if (!creatorId || creatorId !== userId.toString()) {
      return res.status(403).json({ message: 'Only creator can delete group' });
    }

    await Message.deleteMany({ conversationId: id });
    await Conversation.findByIdAndDelete(id);

    return res.status(204).send();
  } catch (err) {
    console.error('deleteGroup error', err);
    return res.status(500).json({ message: 'Failed to delete group' });
  }
};
