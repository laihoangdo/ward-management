package com.policemanagement.com.service.roster;

import com.policemanagement.com.service.AttachmentRecords;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Portrait photos of a resident (attachment owner kind RESIDENT). Every call re-checks that the resident belongs to the caller's
 * hamlet; uploads and deletes need canUpdateInspection.
 */
@Service
@Transactional
public class ResidentPhotoService {

    static final int MAX_PHOTOS = 10;
    private static final String KIND = "RESIDENT";

    public record Photo(UUID id, String caption, boolean primary, String createdAt, String createdBy, long size, String mime) {
        static Photo of(AttachmentRecords.Attachment a) {
            return new Photo(a.id(), a.caption(), a.primary(), a.createdAt(), a.createdBy(), a.size(), a.mime());
        }
    }

    public record Content(byte[] bytes, String mime) {}

    private final RosterService roster;
    private final AttachmentRecords attachments;

    public ResidentPhotoService(RosterService roster, AttachmentRecords attachments) {
        this.roster = roster;
        this.attachments = attachments;
    }

    @Transactional(readOnly = true)
    public List<Photo> list(UUID resident) {
        roster.requireResident(resident, null);
        return attachments.list(KIND, resident).stream().map(Photo::of).toList();
    }

    @Transactional(readOnly = true)
    public Content content(UUID resident, UUID photo) {
        roster.requireResident(resident, null);
        var content = attachments.content(KIND, resident, photo);
        return new Content(content.bytes(), content.mime());
    }

    public Photo upload(UUID resident, byte[] bytes, String caption) {
        long hamlet = roster.requireResident(resident, "canUpdateInspection");
        return Photo.of(
            attachments.add(KIND, resident, hamlet, bytes, caption, "PORTRAIT", false, MAX_PHOTOS, true, "roster-resident:" + resident)
        );
    }

    public List<Photo> makePrimary(UUID resident, UUID photo) {
        roster.requireResident(resident, "canUpdateInspection");
        return attachments.makePrimary(KIND, resident, photo).stream().map(Photo::of).toList();
    }

    public void delete(UUID resident, UUID photo) {
        roster.requireResident(resident, "canUpdateInspection");
        attachments.delete(KIND, resident, photo, "roster-resident:" + resident);
    }
}
