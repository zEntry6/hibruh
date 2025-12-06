const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const {
  createGroup,
  updateGroupDetails,
  modifyGroupMembers,
  updateGroupAdmins,
  generateGroupInvite,
  joinGroupByCode,
  leaveGroup,
  deleteGroup
} = require('../controllers/groupController');

router.use(auth);

router.post('/', createGroup);
router.post('/join-by-code', joinGroupByCode);
router.patch('/:id', updateGroupDetails);
router.patch('/:id/members', modifyGroupMembers);
router.patch('/:id/admins', updateGroupAdmins);
router.post('/:id/invite', generateGroupInvite);
router.post('/:id/leave', leaveGroup);
router.delete('/:id', deleteGroup);

module.exports = router;
